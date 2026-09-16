import { type Response, Router } from "express";

import { HttpError } from "../errors/http-error.js";

import type { ResourceService } from "./resource.service.js";

function createResourceRouter({ resourceService }: { resourceService: ResourceService }) {
  const router = Router();

  router.post("/", async (request, response) => {
    try {
      const body = request.body as Record<string, unknown>;
      const resource = await resourceService.create({
        owner_id: String(body.owner_id ?? ""),
        card_catalog_id: String(body.card_catalog_id ?? ""),
        visibility: body.visibility as "private" | "friends" | "network" | undefined,
        request_enabled: body.request_enabled !== undefined ? Boolean(body.request_enabled) : undefined,
        notes: body.notes !== undefined ? String(body.notes ?? "") || null : null,
      });

      response.status(201).json(resource);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/", async (request, response) => {
    try {
      const userId = String(request.query.user_id ?? "");
      const resources = await resourceService.list(userId);
      response.status(200).json(resources);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/:id", async (request, response) => {
    try {
      const resource = await resourceService.getById(
        request.params.id ?? "",
        String(request.query.user_id ?? ""),
      );
      response.status(200).json(resource);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.patch("/:id", async (request, response) => {
    try {
      const resource = await resourceService.update(
        request.params.id ?? "",
        String(request.body?.user_id ?? ""),
        {
          visibility: request.body?.visibility as "private" | "friends" | "network" | undefined,
          request_enabled: request.body?.request_enabled as boolean | undefined,
          notes: request.body?.notes !== undefined ? String(request.body.notes ?? "") || null : undefined,
          status: request.body?.status as "active" | "inactive" | "removed" | undefined,
        },
      );

      response.status(200).json(resource);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.delete("/:id", async (request, response) => {
    try {
      await resourceService.delete(request.params.id ?? "", String(request.body?.user_id ?? request.query.user_id ?? ""));
      response.status(204).send();
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

export { createResourceRouter };
