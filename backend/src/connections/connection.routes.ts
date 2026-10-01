import { Router } from "express";

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
};

function createConnectionRouter({ connectionService }: ConnectionRouterDependencies) {
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

  router.post("/", mutationRateLimit, async (request, response) => {
    try {
      const input = parseCreateConnectionInput(request.body);
      const connection = await connectionService.sendRequest(input);

      response.status(201).json({ connection });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.post("/:id/accept", mutationRateLimit, async (request, response) => {
    try {
      const input = parseConnectionActorInput(request.params, request.query);
      const connection = await connectionService.accept(input);

      response.status(200).json({ connection });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.post("/:id/block", mutationRateLimit, async (request, response) => {
    try {
      const input = parseConnectionActorInput(request.params, request.query);
      const connection = await connectionService.block(input);

      response.status(200).json({ connection });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.delete("/:id", mutationRateLimit, async (request, response) => {
    try {
      const input = parseConnectionActorInput(request.params, request.query);
      await connectionService.remove(input);

      response.status(204).send();
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/", listRateLimit, async (request, response) => {
    try {
      const input = parseListConnectionsInput(request.query);
      const connections = await connectionService.list(input);

      response.status(200).json({ connections });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  return router;
}

export { createConnectionRouter };
