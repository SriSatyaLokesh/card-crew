import { type RequestHandler, type Response, Router } from "express";

import { HttpError } from "../errors/http-error.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";

import { parseSyncUserInput } from "./user.validation.js";
import type { UserService } from "./user.service.js";

type UserRouterDependencies = {
  userService: UserService;
  userAuthMiddleware: RequestHandler;
  optionalUserAuthMiddleware: RequestHandler;
};

function createUserRouter({
  userService,
  userAuthMiddleware,
  optionalUserAuthMiddleware,
}: UserRouterDependencies) {
  const router = Router();
  const syncRateLimit = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 10,
    errorMessage: "Too many profile sync attempts, please try again later",
  });
  const profileRateLimit = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 30,
    errorMessage: "Too many profile requests, please try again later",
  });

  router.post("/sync", syncRateLimit, userAuthMiddleware, async (request, response) => {
    try {
      const input = parseSyncUserInput(request.body);
      const user = await userService.syncProfile({
        ...input,
        auth_user_id: request.authUserId ?? "",
        auth_email: request.authEmail ?? null,
        auth_user_metadata: request.authUserMetadata ?? null,
      });

      response.status(200).json({ user });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/:id", profileRateLimit, optionalUserAuthMiddleware, async (request, response) => {
    try {
      const rawId = request.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      response.set("Cache-Control", "private, no-store");
      response.set("Vary", "Authorization");
      const user = request.authUserId === id
        ? await userService.getProfile(id ?? "")
        : await userService.getPublicProfile(id ?? "");

      response.status(200).json({ user });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  return router;
}

function sendErrorResponse(error: unknown, response: Response) {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
}

export { createUserRouter };
