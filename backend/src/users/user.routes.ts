import { type RequestHandler, Router } from "express";

import { sendErrorResponse } from "../errors/send-error-response.js";
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

  router.get("/search", profileRateLimit, optionalUserAuthMiddleware, async (request, response) => {
    try {
      const q = typeof request.query.q === "string" ? request.query.q.trim() : "";
      const filter = typeof request.query.filter === "string" ? request.query.filter.trim().toLowerCase() : "";
      let users = await userService.searchUsersWithRelationships(q, request.authUserId);
      if (filter === "friends") {
        users = users.filter((u) => u.relationship === "direct_friend");
      } else if (filter === "fof" || filter === "friends_of_friends") {
        users = users.filter((u) => u.relationship === "friend_of_friend");
      } else if (filter === "requests") {
        users = users.filter((u) => u.relationship === "incoming_request" || u.relationship === "outgoing_request");
      }
      response.status(200).json({ users });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/", profileRateLimit, optionalUserAuthMiddleware, async (request, response) => {
    try {
      const q = typeof request.query.q === "string" ? request.query.q.trim() : "";
      // If user is authenticated, return enriched relationship search; otherwise fallback to public search
      const users = request.authUserId
        ? await userService.searchUsersWithRelationships(q, request.authUserId)
        : await userService.searchUsers(q, request.authUserId);
      response.status(200).json({ users });
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

export { createUserRouter };
