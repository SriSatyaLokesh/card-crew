import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";

import { createApp } from "../app.js";
import { InMemoryConnectionRepository } from "../connections/connection.repository.js";
import { ConnectionService } from "../connections/connection.service.js";
import {
  createOptionalSupabaseAuthMiddleware,
  createSupabaseAuthMiddleware,
  type AuthenticatedSupabaseUser,
  type SupabaseAuthVerifier,
} from "../middleware/supabase-auth.js";
import { InMemoryUserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

let server: http.Server | undefined;

afterEach(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = undefined;
});

async function createTestServer() {
  const userRepository = new InMemoryUserRepository();
  const authVerifier = new StubSupabaseAuthVerifier();
  const app = createApp({
    userService: new UserService({
      userRepository,
    }),
    connectionService: new ConnectionService({
      connectionRepository: new InMemoryConnectionRepository(),
      userRepository,
    }),
    userAuthMiddleware: createSupabaseAuthMiddleware({ verifier: authVerifier }),
    optionalUserAuthMiddleware: createOptionalSupabaseAuthMiddleware({ verifier: authVerifier }),
  });

  server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server?.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    authVerifier,
  };
}

class StubSupabaseAuthVerifier implements SupabaseAuthVerifier {
  private readonly usersByToken = new Map<string, AuthenticatedSupabaseUser>();

  registerToken(token: string, user: AuthenticatedSupabaseUser): void {
    this.usersByToken.set(token, user);
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedSupabaseUser | null> {
    return this.usersByToken.get(token) ?? null;
  }
}

test("POST /users/sync creates a user profile from Supabase auth and returns audit-safe fields only", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("valid-token", {
    id: "supabase-user-1",
    email: "backend@example.com",
    user_metadata: {
      display_name: "Backend Builder",
    },
  });

  const response = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer valid-token",
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    user: Record<string, unknown>;
  };

  assert.equal(body.user.id, "supabase-user-1");
  assert.equal(body.user.email, "backend@example.com");
  assert.equal(body.user.display_name, "Backend Builder");
  assert.equal(body.user.status, "active");
  assert.equal("password_hash" in body.user, false);
  assert.deepEqual(
    Object.keys(body.user).sort(),
    ["created_at", "display_name", "email", "id", "phone", "status", "updated_at"],
  );
});

test("POST /users/sync rejects invalid auth tokens", async () => {
  const { baseUrl } = await createTestServer();
  const response = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({
      display_name: "Duplicate User",
    }),
  });

  assert.equal(response.status, 401);

  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, "Invalid or expired access token");
});

test("POST /users/sync rejects missing required fields when auth metadata is incomplete", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("missing-fields-token", {
    id: "supabase-user-2",
    email: "missing@example.com",
    user_metadata: null,
  });

  const response = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer missing-fields-token",
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, "display_name is required");
});

test("POST /users/sync rejects malformed JSON with a JSON error response", async () => {
  const { baseUrl } = await createTestServer();

  const response = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer valid-token",
    },
    body: "{",
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, "Malformed JSON request body");
});

test("POST /users/sync prefers the verified Supabase email over the request body email", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("email-precedence-token", {
    id: "supabase-user-4",
    email: "verified@example.com",
    user_metadata: {
      display_name: "Verified User",
    },
  });

  const response = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer email-precedence-token",
    },
    body: JSON.stringify({
      email: "spoofed@example.com",
    }),
  });

  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    user: Record<string, unknown>;
  };
  assert.equal(body.user.email, "verified@example.com");
});

test("POST /users/sync preserves an existing display_name when a later sync omits it", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("display-name-token", {
    id: "supabase-user-5",
    email: "preserve@example.com",
    user_metadata: {
      display_name: "Supabase Display Name",
    },
  });

  const firstResponse = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer display-name-token",
    },
    body: JSON.stringify({
      display_name: "Custom Display Name",
    }),
  });

  assert.equal(firstResponse.status, 200);

  const secondResponse = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer display-name-token",
    },
    body: JSON.stringify({}),
  });

  assert.equal(secondResponse.status, 200);

  const body = (await secondResponse.json()) as {
    user: Record<string, unknown>;
  };
  assert.equal(body.user.display_name, "Custom Display Name");
});

test("POST /users/sync rejects overlong display_name values coming from Supabase metadata", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("metadata-display-name-token", {
    id: "supabase-user-7",
    email: "metadata@example.com",
    user_metadata: {
      display_name: "x".repeat(81),
    },
  });

  const response = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer metadata-display-name-token",
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, "display_name is required");
});

test("GET /users/:id returns only audit-safe profile fields to the profile owner", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("profile-token", {
    id: "supabase-user-3",
    email: "profile@example.com",
    user_metadata: {
      display_name: "Profile User",
    },
  });

  const syncResponse = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer profile-token",
    },
    body: JSON.stringify({}),
  });
  const registerBody = (await syncResponse.json()) as {
    user: { id: string };
  };

  const response = await fetch(`${baseUrl}/users/${registerBody.user.id}`);
  const responseWithAuth = await fetch(`${baseUrl}/users/${registerBody.user.id}`, {
    headers: {
      authorization: "Bearer profile-token",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(responseWithAuth.status, 200);

  const publicBody = (await response.json()) as {
    user: Record<string, unknown>;
  };
  const body = (await responseWithAuth.json()) as {
    user: Record<string, unknown>;
  };

  assert.deepEqual(
    Object.keys(publicBody.user).sort(),
    ["created_at", "display_name", "id", "status", "updated_at"],
  );
  assert.equal("email" in publicBody.user, false);
  assert.equal("phone" in publicBody.user, false);
  assert.equal(body.user.id, registerBody.user.id);
  assert.equal(body.user.email, "profile@example.com");
  assert.equal(body.user.display_name, "Profile User");
  assert.equal(body.user.status, "active");
  assert.equal("password_hash" in body.user, false);
  assert.deepEqual(
    Object.keys(body.user).sort(),
    ["created_at", "display_name", "email", "id", "phone", "status", "updated_at"],
  );
});

test("GET /users/:id falls back to the public profile view when the bearer token is invalid", async () => {
  const { baseUrl, authVerifier } = await createTestServer();
  authVerifier.registerToken("public-profile-token", {
    id: "supabase-user-6",
    email: "public@example.com",
    user_metadata: {
      display_name: "Public User",
    },
  });

  const syncResponse = await fetch(`${baseUrl}/users/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer public-profile-token",
    },
    body: JSON.stringify({}),
  });

  assert.equal(syncResponse.status, 200);

  const createdUser = (await syncResponse.json()) as {
    user: { id: string };
  };

  const response = await fetch(`${baseUrl}/users/${createdUser.user.id}`, {
    headers: {
      authorization: "Bearer invalid-token",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Authorization");

  const body = (await response.json()) as {
    user: Record<string, unknown>;
  };
  assert.deepEqual(
    Object.keys(body.user).sort(),
    ["created_at", "display_name", "id", "status", "updated_at"],
  );
  assert.equal("email" in body.user, false);
  assert.equal("phone" in body.user, false);
});
