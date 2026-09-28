import { type RequestHandler, Router } from "express";

import { sendErrorResponse } from "../errors/send-error-response.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";

import {
  parseConnectionActorInput,
  parseCreateConnectionInput,
  parseListConnectionsInput,
} from "./connection.validation.js";
import type { ConnectionService } from "./connection.service.js";

type ConnectionRouterDependencies = {
  connectionService: ConnectionService;
  optionalUserAuthMiddleware?: RequestHandler;
};

export function createConnectionRouter({
  connectionService,
  optionalUserAuthMiddleware,
}: ConnectionRouterDependencies) {
  const router = Router();
  const mutationRateLimit = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 30,
    errorMessage: "Too many connection changes, please try again later",
  });
  const listRateLimit = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 60,
    errorMessage: "Too many connection list requests, please try again later",
  });

  const authMiddleware: RequestHandler = optionalUserAuthMiddleware ?? ((_req, _res, next) => next());

  // GET /connections/blocked - list blocked users
  router.get("/blocked", listRateLimit, authMiddleware, async (request, response) => {
    try {
      const userId = request.authUserId || String(request.query.user_id || "");
      if (!userId) {
        response.status(401).json({ error: "Authenticated user ID is required" });
        return;
      }

      const blocks = await connectionService.listBlocked(userId);
      response.status(200).json({ blocks });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // POST /connections - send friend/connection request
  router.post("/", mutationRateLimit, authMiddleware, async (request, response) => {
    try {
      const requesterId = request.authUserId || request.body.requester_id;
      const input = parseCreateConnectionInput({
        ...request.body,
        requester_id: requesterId,
      });
      const connection = await connectionService.sendRequest(input);

      response.status(201).json({ connection });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // POST /connections/:id/accept - accept connection request
  router.post("/:id/accept", mutationRateLimit, authMiddleware, async (request, response) => {
    try {
      const userId = request.authUserId || String(request.query.user_id || request.body?.user_id || "");
      const input = parseConnectionActorInput(request.params, { user_id: userId });
      const connection = await connectionService.accept(input);

      response.status(200).json({ connection });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // POST /connections/:id/decline - decline connection request
  router.post("/:id/decline", mutationRateLimit, authMiddleware, async (request, response) => {
    try {
      const userId = request.authUserId || String(request.query.user_id || request.body?.user_id || "");
      const input = parseConnectionActorInput(request.params, { user_id: userId });
      await connectionService.decline(input);

      response.status(200).json({ success: true });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // Block user endpoint: POST /connections/users/:userId/block or POST /connections/:targetId/block
  router.post(["/users/:targetUserId/block", "/:targetUserId/block"], mutationRateLimit, authMiddleware, async (request, response) => {
    try {
      const blockerId = request.authUserId || String(request.query.user_id || request.body?.user_id || "");
      const targetUserId = String(request.params.targetUserId || "");

      if (!blockerId) {
        response.status(401).json({ error: "Authenticated user ID is required" });
        return;
      }

      // First check if targetUserId might be a connection ID from old tests
      try {
        const input = parseConnectionActorInput({ id: targetUserId }, request.query);
        const connection = await connectionService.block(input);
        response.status(200).json({ connection });
        return;
      } catch {
        // Not a connection ID or normal user block flow: block by target user ID
      }

      await connectionService.blockUser(blockerId, targetUserId);
      response.status(200).json({ success: true, blocked_user_id: targetUserId });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // Unblock user endpoint: POST /connections/users/:userId/unblock or POST /connections/:targetUserId/unblock
  router.post(["/users/:targetUserId/unblock", "/:targetUserId/unblock"], mutationRateLimit, authMiddleware, async (request, response) => {
    try {
      const blockerId = request.authUserId || String(request.query.user_id || request.body?.user_id || "");
      const targetUserId = String(request.params.targetUserId || "");

      if (!blockerId) {
        response.status(401).json({ error: "Authenticated user ID is required" });
        return;
      }

      await connectionService.unblockUser(blockerId, targetUserId);
      response.status(200).json({ success: true, unblocked_user_id: targetUserId });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // DELETE /connections/:id - remove connection or cancel request
  router.delete("/:id", mutationRateLimit, authMiddleware, async (request, response) => {
    try {
      const userId = request.authUserId || String(request.query.user_id || request.body?.user_id || "");
      const input = parseConnectionActorInput(request.params, { user_id: userId });
      await connectionService.remove(input);

      response.status(204).send();
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  // GET /connections - list connections
  router.get("/", listRateLimit, authMiddleware, async (request, response) => {
    try {
      const userId = request.authUserId || String(request.query.user_id || "");
      const input = parseListConnectionsInput({
        ...request.query,
        user_id: userId,
      });
      const connections = await connectionService.list(input);

      response.status(200).json({ connections });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  return router;
}
