import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import type { RequestHandler } from "express";

import { createApp } from "../app.js";
import { InMemoryConnectionRepository } from "./connection.repository.js";
import { ConnectionService } from "./connection.service.js";
import { InMemoryUserRepository } from "../users/user.repository.js";
import { UserService } from "../users/user.service.js";
import type { UserRepository } from "../users/user.repository.js";

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
  const userAuthMiddleware: RequestHandler = (_request, _response, next) => next();
  const optionalUserAuthMiddleware: RequestHandler = (_request, _response, next) => next();
  const app = createApp({
    userService: new UserService({
      userRepository,
    }),
    connectionService: new ConnectionService({
      connectionRepository: new InMemoryConnectionRepository(),
      userRepository,
    }),
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });

  server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server?.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    userRepository,
  };
}

let nextUserId = 1;

async function registerUser(userRepository: UserRepository, email: string, displayName: string) {
  const user = await userRepository.upsertProfile({
    id: `supabase-user-${nextUserId++}`,
    email,
    display_name: displayName,
    status: "active",
  });
  return user.id;
}

async function createConnectionRequest(baseUrl: string, requesterId: string, addresseeId: string) {
  const response = await fetch(`${baseUrl}/connections`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requester_id: requesterId,
      addressee_id: addresseeId,
    }),
  });

  return response;
}

test("POST /connections sends a pending connection request", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const requesterId = await registerUser(userRepository, "requester@example.com", "Requester");
  const addresseeId = await registerUser(userRepository, "addressee@example.com", "Addressee");

  const response = await createConnectionRequest(baseUrl, requesterId, addresseeId);

  assert.equal(response.status, 201);

  const body = (await response.json()) as {
    connection: {
      requester_id: string;
      addressee_id: string;
      status: string;
    };
  };

  assert.equal(body.connection.requester_id, requesterId);
  assert.equal(body.connection.addressee_id, addresseeId);
  assert.equal(body.connection.status, "pending");
});

test("POST /connections rejects duplicate pending requests between the same users", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const requesterId = await registerUser(userRepository, "dupe-requester@example.com", "Requester");
  const addresseeId = await registerUser(userRepository, "dupe-addressee@example.com", "Addressee");

  const firstResponse = await createConnectionRequest(baseUrl, requesterId, addresseeId);
  assert.equal(firstResponse.status, 201);

  const duplicateResponse = await createConnectionRequest(baseUrl, addresseeId, requesterId);

  assert.equal(duplicateResponse.status, 409);

  const body = (await duplicateResponse.json()) as { error?: string };
  assert.equal(body.error, "A pending connection already exists between these users");
});

test("POST /connections rejects self-connection requests", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const userId = await registerUser(userRepository, "self@example.com", "Self User");

  const response = await createConnectionRequest(baseUrl, userId, userId);

  assert.equal(response.status, 400);

  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, "You cannot send a connection request to yourself");
});

test("POST /connections/:id/accept only allows the addressee to accept a pending request", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const requesterId = await registerUser(userRepository, "accept-requester@example.com", "Requester");
  const addresseeId = await registerUser(userRepository, "accept-addressee@example.com", "Addressee");
  const requestResponse = await createConnectionRequest(baseUrl, requesterId, addresseeId);
  const requestBody = (await requestResponse.json()) as {
    connection: { id: string };
  };

  const wrongPartyResponse = await fetch(
    `${baseUrl}/connections/${requestBody.connection.id}/accept?user_id=${requesterId}`,
    { method: "POST" },
  );

  assert.equal(wrongPartyResponse.status, 403);
  assert.equal(
    ((await wrongPartyResponse.json()) as { error?: string }).error,
    "Only the addressee can accept this connection request",
  );

  const correctPartyResponse = await fetch(
    `${baseUrl}/connections/${requestBody.connection.id}/accept?user_id=${addresseeId}`,
    { method: "POST" },
  );

  assert.equal(correctPartyResponse.status, 200);

  const acceptedBody = (await correctPartyResponse.json()) as {
    connection: { status: string };
  };
  assert.equal(acceptedBody.connection.status, "accepted");

  const secondAcceptResponse = await fetch(
    `${baseUrl}/connections/${requestBody.connection.id}/accept?user_id=${addresseeId}`,
    { method: "POST" },
  );

  assert.equal(secondAcceptResponse.status, 409);
  assert.equal(
    ((await secondAcceptResponse.json()) as { error?: string }).error,
    "Only pending connections can be accepted",
  );
});

test("POST /connections/:id/block blocks pending or accepted connections", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const requesterId = await registerUser(userRepository, "block-requester@example.com", "Requester");
  const addresseeId = await registerUser(userRepository, "block-addressee@example.com", "Addressee");
  const requestResponse = await createConnectionRequest(baseUrl, requesterId, addresseeId);
  const requestBody = (await requestResponse.json()) as {
    connection: { id: string };
  };

  const acceptResponse = await fetch(
    `${baseUrl}/connections/${requestBody.connection.id}/accept?user_id=${addresseeId}`,
    { method: "POST" },
  );
  assert.equal(acceptResponse.status, 200);

  const blockResponse = await fetch(
    `${baseUrl}/connections/${requestBody.connection.id}/block?user_id=${requesterId}`,
    { method: "POST" },
  );

  assert.equal(blockResponse.status, 200);

  const blockBody = (await blockResponse.json()) as {
    connection: { status: string };
  };
  assert.equal(blockBody.connection.status, "blocked");
});

test("DELETE /connections/:id marks a connection as removed", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const requesterId = await registerUser(userRepository, "remove-requester@example.com", "Requester");
  const addresseeId = await registerUser(userRepository, "remove-addressee@example.com", "Addressee");
  const requestResponse = await createConnectionRequest(baseUrl, requesterId, addresseeId);
  const requestBody = (await requestResponse.json()) as {
    connection: { id: string };
  };

  const removeResponse = await fetch(
    `${baseUrl}/connections/${requestBody.connection.id}?user_id=${requesterId}`,
    { method: "DELETE" },
  );

  assert.equal(removeResponse.status, 204);

  const removedListResponse = await fetch(
    `${baseUrl}/connections?user_id=${requesterId}&status=removed`,
  );

  assert.equal(removedListResponse.status, 200);

  const removedBody = (await removedListResponse.json()) as {
    connections: Array<{ id: string; status: string }>;
  };

  assert.equal(removedBody.connections.length, 1);
  assert.equal(removedBody.connections[0]?.id, requestBody.connection.id);
  assert.equal(removedBody.connections[0]?.status, "removed");
});

test("GET /connections filters the current user's connections by status", async () => {
  const { baseUrl, userRepository } = await createTestServer();
  const currentUserId = await registerUser(userRepository, "current@example.com", "Current User");
  const pendingUserId = await registerUser(userRepository, "pending@example.com", "Pending User");
  const acceptedUserId = await registerUser(userRepository, "accepted@example.com", "Accepted User");
  const blockedUserId = await registerUser(userRepository, "blocked@example.com", "Blocked User");
  const removedUserId = await registerUser(userRepository, "removed@example.com", "Removed User");

  const pendingResponse = await createConnectionRequest(baseUrl, currentUserId, pendingUserId);
  const acceptedResponse = await createConnectionRequest(baseUrl, acceptedUserId, currentUserId);
  const blockedResponse = await createConnectionRequest(baseUrl, blockedUserId, currentUserId);
  const removedResponse = await createConnectionRequest(baseUrl, removedUserId, currentUserId);

  const pendingConnectionId = ((await pendingResponse.json()) as { connection: { id: string } }).connection.id;
  const acceptedConnectionId = ((await acceptedResponse.json()) as { connection: { id: string } }).connection.id;
  const blockedConnectionId = ((await blockedResponse.json()) as { connection: { id: string } }).connection.id;
  const removedConnectionId = ((await removedResponse.json()) as { connection: { id: string } }).connection.id;

  await fetch(`${baseUrl}/connections/${acceptedConnectionId}/accept?user_id=${currentUserId}`, {
    method: "POST",
  });
  await fetch(`${baseUrl}/connections/${blockedConnectionId}/block?user_id=${currentUserId}`, {
    method: "POST",
  });
  await fetch(`${baseUrl}/connections/${removedConnectionId}?user_id=${currentUserId}`, {
    method: "DELETE",
  });

  const pendingListResponse = await fetch(
    `${baseUrl}/connections?user_id=${currentUserId}&status=pending`,
  );
  const acceptedListResponse = await fetch(
    `${baseUrl}/connections?user_id=${currentUserId}&status=accepted`,
  );
  const blockedListResponse = await fetch(
    `${baseUrl}/connections?user_id=${currentUserId}&status=blocked`,
  );
  const removedListResponse = await fetch(
    `${baseUrl}/connections?user_id=${currentUserId}&status=removed`,
  );

  assert.equal(pendingListResponse.status, 200);
  assert.equal(acceptedListResponse.status, 200);
  assert.equal(blockedListResponse.status, 200);
  assert.equal(removedListResponse.status, 200);

  const pendingBody = (await pendingListResponse.json()) as {
    connections: Array<{ id: string }>;
  };
  const acceptedBody = (await acceptedListResponse.json()) as {
    connections: Array<{ id: string }>;
  };
  const blockedBody = (await blockedListResponse.json()) as {
    connections: Array<{ id: string }>;
  };
  const removedBody = (await removedListResponse.json()) as {
    connections: Array<{ id: string }>;
  };

  assert.deepEqual(pendingBody.connections.map((connection) => connection.id), [pendingConnectionId]);
  assert.deepEqual(acceptedBody.connections.map((connection) => connection.id), [acceptedConnectionId]);
  assert.deepEqual(blockedBody.connections.map((connection) => connection.id), [blockedConnectionId]);
  assert.deepEqual(removedBody.connections.map((connection) => connection.id), [removedConnectionId]);
});
