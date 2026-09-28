import type { PrismaClient } from "@prisma/client";
import type { CardRecord, CreateCardInput, UpdateCardInput } from "./card.types.js";

export interface CardRepository {
  create(userId: string, input: CreateCardInput): Promise<CardRecord>;
  findById(id: string): Promise<CardRecord | null>;
  listByUser(userId: string, allowedScopes?: ("DIRECT_FRIENDS" | "TOTAL_NETWORK")[]): Promise<CardRecord[]>;
  update(id: string, input: UpdateCardInput): Promise<CardRecord>;
  delete(id: string): Promise<void>;
  countByUser(userId: string, allowedScopes?: ("DIRECT_FRIENDS" | "TOTAL_NETWORK")[]): Promise<number>;
  syncFromResourcesIfEmpty(userId: string): Promise<void>;
}

export class PrismaCardRepository implements CardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, input: CreateCardInput): Promise<CardRecord> {
    const card = await this.prisma.card.create({
      data: {
        user_id: userId,
        card_name: input.cardName,
        card_type: input.cardType,
        visibility_scope: input.visibilityScope || "DIRECT_FRIENDS",
      },
    });

    return mapPrismaCard(card as unknown as PrismaCardWithScope);
  }

  async findById(id: string): Promise<CardRecord | null> {
    const card = await this.prisma.card.findUnique({
      where: { id },
    });

    return card ? mapPrismaCard(card as unknown as PrismaCardWithScope) : null;
  }

  async listByUser(userId: string, allowedScopes?: ("DIRECT_FRIENDS" | "TOTAL_NETWORK")[]): Promise<CardRecord[]> {
    // If user has no cards yet, check if they have existing resources from catalog and auto-populate
    await this.syncFromResourcesIfEmpty(userId);

    const whereClause: Record<string, unknown> = { user_id: userId };
    if (allowedScopes && allowedScopes.length > 0) {
      whereClause.visibility_scope = { in: allowedScopes };
    }

    const cards = await this.prisma.card.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
    });

    return cards.map((c) => mapPrismaCard(c as unknown as PrismaCardWithScope));
  }

  async update(id: string, input: UpdateCardInput): Promise<CardRecord> {
    const card = await this.prisma.card.update({
      where: { id },
      data: {
        ...(input.cardName ? { card_name: input.cardName } : {}),
        ...(input.cardType ? { card_type: input.cardType } : {}),
        ...(input.visibilityScope ? { visibility_scope: input.visibilityScope } : {}),
      },
    });

    return mapPrismaCard(card as unknown as PrismaCardWithScope);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.card.delete({
      where: { id },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.card.count({
      where: { user_id: userId },
    });
  }

  async syncFromResourcesIfEmpty(userId: string): Promise<void> {
    const existingCount = await this.prisma.card.count({
      where: { user_id: userId },
    });

    if (existingCount > 0) return;

    // Check if user has resources
    const resources = await this.prisma.resource.findMany({
      where: { owner_id: userId, status: "active" },
      include: { card: true },
    });

    for (const r of resources) {
      if (r.card) {
        const rawType = r.card.card_category || r.card.card_type;
        const normalized =
          rawType === "debit"
            ? "Debit Card"
            : rawType === "prepaid"
            ? "Prepaid Card"
            : "Credit Card";

        await this.prisma.card.create({
          data: {
            user_id: userId,
            card_name: `${r.card.issuer} ${r.card.product_name}`.trim(),
            card_type: normalized,
          },
        });
      }
    }
  }
}

export type PrismaCardWithScope = {
  id: string;
  user_id: string;
  card_name: string;
  card_type: string;
  visibility_scope?: string | null;
  created_at: Date;
  updated_at: Date;
};

export class InMemoryCardRepository implements CardRepository {
  private cards = new Map<string, CardRecord>();

  async create(userId: string, input: CreateCardInput): Promise<CardRecord> {
    const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const record: CardRecord = {
      id,
      userId,
      cardName: input.cardName,
      cardType: input.cardType,
      visibilityScope: input.visibilityScope || "DIRECT_FRIENDS",
      createdAt: now,
      updatedAt: now,
    };
    this.cards.set(id, record);
    return record;
  }

  async findById(id: string): Promise<CardRecord | null> {
    return this.cards.get(id) || null;
  }

  async listByUser(userId: string, allowedScopes?: ("DIRECT_FRIENDS" | "TOTAL_NETWORK")[]): Promise<CardRecord[]> {
    return [...this.cards.values()]
      .filter((c) => {
        if (c.userId !== userId) return false;
        if (allowedScopes && allowedScopes.length > 0) {
          return allowedScopes.includes(c.visibilityScope);
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async update(id: string, input: UpdateCardInput): Promise<CardRecord> {
    const existing = this.cards.get(id);
    if (!existing) throw new Error("Card not found");
    const updated: CardRecord = {
      ...existing,
      cardName: input.cardName ?? existing.cardName,
      cardType: input.cardType ?? existing.cardType,
      visibilityScope: input.visibilityScope ?? existing.visibilityScope,
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.cards.delete(id);
  }

  async countByUser(userId: string, allowedScopes?: ("DIRECT_FRIENDS" | "TOTAL_NETWORK")[]): Promise<number> {
    return (await this.listByUser(userId, allowedScopes)).length;
  }

  async syncFromResourcesIfEmpty(_userId: string): Promise<void> {
    // No-op for in-memory
  }
}

function mapPrismaCard(card: PrismaCardWithScope): CardRecord {
  return {
    id: card.id,
    userId: card.user_id,
    cardName: card.card_name,
    cardType: card.card_type,
    visibilityScope: (card.visibility_scope as "DIRECT_FRIENDS" | "TOTAL_NETWORK") || "DIRECT_FRIENDS",
    createdAt: card.created_at.toISOString(),
    updatedAt: card.updated_at.toISOString(),
  };
}
