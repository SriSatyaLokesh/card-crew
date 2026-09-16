import {
  createClient,
  type SupabaseClient,
  type User as SupabaseUser,
} from "@supabase/supabase-js";
import type { Request, RequestHandler, Response } from "express";

type AuthenticatedSupabaseUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown> | null;
};

type CreateSupabaseAuthVerifierOptions = {
  url?: string;
  serviceRoleKey?: string;
};

interface SupabaseAuthVerifier {
  verifyAccessToken(token: string): Promise<AuthenticatedSupabaseUser | null>;
}

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authEmail?: string | null;
      authUserMetadata?: Record<string, unknown> | null;
    }
  }
}

class SupabaseClientAuthVerifier implements SupabaseAuthVerifier {
  constructor(private readonly client: SupabaseClient) {}

  async verifyAccessToken(token: string): Promise<AuthenticatedSupabaseUser | null> {
    const { data, error } = await this.client.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return mapSupabaseUser(data.user);
  }
}

function createSupabaseAuthVerifier({
  url,
  serviceRoleKey,
}: CreateSupabaseAuthVerifierOptions): SupabaseAuthVerifier {
  if (!url?.trim()) {
    throw new Error("SUPABASE_URL is required");
  }

  if (!serviceRoleKey?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return new SupabaseClientAuthVerifier(client);
}

function createSupabaseAuthMiddleware({ verifier }: { verifier: SupabaseAuthVerifier }): RequestHandler {
  return async (request, response, next) => {
    const token = readBearerToken(request);

    if (!token) {
      sendUnauthorized(response, "Authorization header must use the Bearer scheme");
      return;
    }

    try {
      const user = await verifier.verifyAccessToken(token);

      if (!user) {
        sendUnauthorized(response, "Invalid or expired access token");
        return;
      }

      attachAuthenticatedUser(request, user);
      next();
    } catch (error) {
      console.error(error);
      sendUnauthorized(response, "Invalid or expired access token");
    }
  };
}

function createOptionalSupabaseAuthMiddleware({ verifier }: { verifier: SupabaseAuthVerifier }): RequestHandler {
  return async (request, response, next) => {
    const token = readBearerToken(request);

    if (!token) {
      next();
      return;
    }

    try {
      const user = await verifier.verifyAccessToken(token);

      if (!user) {
        clearAuthenticatedUser(request);
        next();
        return;
      }

      attachAuthenticatedUser(request, user);
      next();
    } catch (error) {
      console.error(error);
      clearAuthenticatedUser(request);
      next();
    }
  };
}

function readBearerToken(request: Request): string | null {
  const authorizationHeader = request.header("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}

function sendUnauthorized(response: Response, message: string): void {
  response.status(401).json({ error: message });
}

function attachAuthenticatedUser(request: Request, user: AuthenticatedSupabaseUser): void {
  request.authUserId = user.id;
  request.authEmail = user.email;
  request.authUserMetadata = user.user_metadata;
}

function clearAuthenticatedUser(request: Request): void {
  request.authUserId = undefined;
  request.authEmail = undefined;
  request.authUserMetadata = undefined;
}

function mapSupabaseUser(user: SupabaseUser): AuthenticatedSupabaseUser {
  return {
    id: user.id,
    email: user.email ?? null,
    user_metadata: isRecord(user.user_metadata) ? user.user_metadata : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { createOptionalSupabaseAuthMiddleware, createSupabaseAuthMiddleware, createSupabaseAuthVerifier };
export type { AuthenticatedSupabaseUser, SupabaseAuthVerifier };
