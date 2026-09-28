import { Router } from "express";
import type { RequestHandler } from "express";
import { sendErrorResponse } from "../errors/send-error-response.js";
import type { CardService } from "./card.service.js";

type CardRouterDependencies = {
  cardService: CardService;
  optionalUserAuthMiddleware?: RequestHandler;
};

export function createCardRouter({
  cardService,
  optionalUserAuthMiddleware,
}: CardRouterDependencies) {
  const router = Router();

  if (optionalUserAuthMiddleware) {
    router.use(optionalUserAuthMiddleware);
  }

  function getEffectiveUserId(req: import("express").Request): string {
    return String(req.authUserId || req.query.user_id || req.body?.userId || req.body?.user_id || "");
  }

  router.post("/", async (request, response) => {
    try {
      const userId = getEffectiveUserId(request);
      const body = request.body as Record<string, unknown>;
      const { card } = await cardService.createCard(userId, {
        cardName: String(body?.cardName ?? body?.card_name ?? ""),
        cardType: String(body?.cardType ?? body?.card_type ?? ""),
        visibilityScope: (body?.visibilityScope ?? body?.visibility_scope) as ("DIRECT_FRIENDS" | "TOTAL_NETWORK") | undefined,
      });

      response.status(201).json({ card });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/", async (request, response) => {
    try {
      const viewerId = String(request.authUserId || request.query.viewer_id || "");
      const targetUserId = String(request.query.user_id || request.query.target_user_id || viewerId);
      const { cards } = await cardService.listCards(targetUserId, viewerId || undefined);
      response.status(200).json({ cards });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/:id", async (request, response) => {
    try {
      const viewerId = getEffectiveUserId(request);
      const { card } = await cardService.getCard(viewerId, request.params.id);
      response.status(200).json({ card });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.patch("/:id", async (request, response) => {
    try {
      const userId = getEffectiveUserId(request);
      const body = request.body as Record<string, unknown>;
      const { card } = await cardService.updateCard(userId, request.params.id, {
        cardName: body?.cardName !== undefined ? String(body.cardName) : body?.card_name !== undefined ? String(body.card_name) : undefined,
        cardType: body?.cardType !== undefined ? String(body.cardType) : body?.card_type !== undefined ? String(body.card_type) : undefined,
        visibilityScope: (body?.visibilityScope ?? body?.visibility_scope) as ("DIRECT_FRIENDS" | "TOTAL_NETWORK") | undefined,
      });

      response.status(200).json({ card });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.delete("/:id", async (request, response) => {
    try {
      const userId = getEffectiveUserId(request);
      await cardService.deleteCard(userId, request.params.id);
      response.status(204).send();
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  return router;
}
