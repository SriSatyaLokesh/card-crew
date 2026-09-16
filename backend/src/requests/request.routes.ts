import { type Response, Router } from "express";

import { HttpError } from "../errors/http-error.js";

import type { RequestService } from "./request.service.js";

function createRequestRouter({ requestService }: { requestService: RequestService }) {
  const router = Router();

  router.post("/", async (request, response) => {
    try {
      const body = request.body as Record<string, unknown>;
      const created = await requestService.create({
        requester_id: String(body.requester_id ?? ""),
        owner_id: String(body.owner_id ?? ""),
        resource_id: String(body.resource_id ?? ""),
        message: typeof body.message === "string" ? body.message : undefined,
      });

      response.status(201).json(created);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/incoming", async (request, response) => {
    try {
      const ownerId = String(request.query.user_id ?? "");
      const result = await requestService.listIncoming(ownerId);
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/outgoing", async (request, response) => {
    try {
      const requesterId = String(request.query.user_id ?? "");
      const result = await requestService.listOutgoing(requesterId);
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/referrals", async (request, response) => {
    try {
      const result = await requestService.listReferral(String(request.query.user_id ?? ""));
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.patch("/:id", async (request, response) => {
    try {
      const result = await requestService.update(request.params.id ?? "", {
        user_id: String(request.body?.user_id ?? ""),
        status: String(request.body?.status ?? "") as "pending" | "approved" | "declined" | "ignored",
      });

      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.patch("/:id/referral", async (request, response) => {
    try {
      const result = await requestService.updateReferral(request.params.id ?? "", {
        user_id: String(request.body?.user_id ?? ""),
        referral_status: String(request.body?.referral_status ?? "") as "approved" | "declined" | "ignored",
      });
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.post("/:id/contact", async (request, response) => {
    try {
      const result = await requestService.revealContact(
        request.params.id ?? "",
        String(request.body?.user_id ?? ""),
        typeof request.body?.message === "string" ? request.body.message : undefined,
      );
      response.status(200).json(result);
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

export { createRequestRouter };
