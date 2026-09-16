import { Router } from "express";

import { toCardCatalogSummary } from "./card-catalog.repository.js";
import type { CardCatalogRepository } from "./card-catalog.repository.js";

function createCatalogRouter({ catalogRepository }: { catalogRepository: CardCatalogRepository }) {
  const router = Router();

  router.get("/cards", async (_request, response) => {
    try {
      const cards = await catalogRepository.listCards();
      response.status(200).json({ cards: cards.map(toCardCatalogSummary) });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/cards/:id", async (request, response) => {
    const card = await catalogRepository.findById(request.params.id ?? "");

    if (!card) {
      response.status(404).json({ error: "Card not found" });
      return;
    }

    response.status(200).json({ card: toCardCatalogSummary(card) });
  });

  return router;
}

export { createCatalogRouter };
