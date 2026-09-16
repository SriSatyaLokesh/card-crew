import { HttpError } from "../errors/http-error.js";

import type { PrismaClient, CardCatalog } from "@prisma/client";

import { DEFAULT_CATALOG } from "./card-catalog.seed.js";
import type { CardCatalogRecord } from "./card-catalog.types.js";

interface CardCatalogRepository {
  listCards(): Promise<CardCatalogRecord[]>;
  findById(id: string): Promise<CardCatalogRecord | null>;
}

class PrismaCardCatalogRepository implements CardCatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureSeeded(): Promise<void> {
    for (const card of DEFAULT_CATALOG) {
      await this.prisma.cardCatalog.upsert({
        where: { id: card.id },
        update: {
          issuer: card.issuer,
          product_name: card.product_name,
          card_type: card.card_type,
          card_category: card.card_category,
          network: card.network,
          variant: card.variant,
          country: card.country,
          upi_enabled: card.upi_enabled,
          use_cases: card.use_cases,
          active: card.active,
        },
        create: {
          id: card.id,
          issuer: card.issuer,
          product_name: card.product_name,
          card_type: card.card_type,
          card_category: card.card_category,
          network: card.network,
          variant: card.variant,
          country: card.country,
          upi_enabled: card.upi_enabled,
          use_cases: card.use_cases,
          active: card.active,
        },
      });
    }
  }

  async listCards(): Promise<CardCatalogRecord[]> {
    const cards = await this.prisma.cardCatalog.findMany({
      where: { active: true },
    });

    return cards.map(mapPrismaCard).sort(byHdfcThenName);
  }

  async findById(id: string): Promise<CardCatalogRecord | null> {
    const card = await this.prisma.cardCatalog.findUnique({ where: { id } });

    if (!card || !card.active) {
      return null;
    }

    return mapPrismaCard(card);
  }
}

class InMemoryCardCatalogRepository implements CardCatalogRepository {
  private readonly cardsById = new Map<string, CardCatalogRecord>();

  constructor() {
    for (const card of DEFAULT_CATALOG) {
      this.cardsById.set(card.id, card);
    }
  }

  async listCards(): Promise<CardCatalogRecord[]> {
    return [...this.cardsById.values()].filter((card) => card.active).sort(byHdfcThenName);
  }

  async findById(id: string): Promise<CardCatalogRecord | null> {
    const card = this.cardsById.get(id);

    if (!card || !card.active) {
      return null;
    }

    return card;
  }
}

function byHdfcThenName(left: CardCatalogRecord, right: CardCatalogRecord): number {
  const leftPriority = left.issuer === "HDFC" ? 0 : 1;
  const rightPriority = right.issuer === "HDFC" ? 0 : 1;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.product_name.localeCompare(right.product_name);
}

function mapPrismaCard(card: CardCatalog): CardCatalogRecord {
  return {
    id: card.id,
    issuer: card.issuer,
    product_name: card.product_name,
    card_type: card.card_type as CardCatalogRecord["card_type"],
    card_category: card.card_category as CardCatalogRecord["card_category"],
    network: card.network,
    variant: card.variant,
    country: card.country,
    upi_enabled: card.upi_enabled,
    use_cases: card.use_cases,
    active: card.active,
    created_at: card.created_at,
    updated_at: card.updated_at,
  };
}

function toCardCatalogSummary(card: CardCatalogRecord) {
  return {
    id: card.id,
    issuer: card.issuer,
    product_name: card.product_name,
    card_type: card.card_type,
    card_category: card.card_category,
    network: card.network,
    variant: card.variant,
    country: card.country,
    upi_enabled: card.upi_enabled,
    use_cases: card.use_cases,
    active: card.active,
    created_at: card.created_at.toISOString(),
    updated_at: card.updated_at.toISOString(),
  };
}

function assertCatalogCardExists(card: CardCatalogRecord | null, cardCatalogId: string): asserts card is CardCatalogRecord {
  if (!card) {
    throw new HttpError(404, `Card catalog entry not found: ${cardCatalogId}`);
  }
}

export { InMemoryCardCatalogRepository, PrismaCardCatalogRepository, toCardCatalogSummary };
export type { CardCatalogRepository };
export { assertCatalogCardExists };
