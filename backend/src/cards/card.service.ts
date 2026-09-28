import { HttpError } from "../errors/http-error.js";
import type { UserRepository } from "../users/user.repository.js";
import type { CardCatalogRepository } from "../catalog/card-catalog.repository.js";
import type { ResourceRepository } from "../resources/resource.repository.js";
import type { ConnectionRepository } from "../connections/connection.repository.js";
import type { CardRepository } from "./card.repository.js";
import { normalizeCardType, normalizeVisibilityScope, SUPPORTED_CARD_TYPES } from "./card.types.js";
import type { CardRecord, CreateCardInput, UpdateCardInput } from "./card.types.js";

type CardServiceDependencies = {
  cardRepository: CardRepository;
  userRepository: UserRepository;
  cardCatalogRepository?: CardCatalogRepository;
  resourceRepository?: ResourceRepository;
  connectionRepository?: ConnectionRepository;
};

export class CardService {
  constructor(private readonly deps: CardServiceDependencies) {}

  async createCard(userId: string, input: CreateCardInput): Promise<{ card: CardRecord }> {
    if (!userId?.trim()) {
      throw new HttpError(401, "Authentication required");
    }

    const user = await this.deps.userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "User does not exist");
    }

    const trimmedName = input.cardName?.trim();
    if (!trimmedName) {
      throw new HttpError(400, "Card name is required");
    }
    if (trimmedName.length > 100) {
      throw new HttpError(400, "Card name must be 100 characters or fewer");
    }

    const normalizedType = normalizeCardType(input.cardType ?? "");
    if (!normalizedType) {
      throw new HttpError(
        400,
        `Invalid card type. Supported types: ${SUPPORTED_CARD_TYPES.join(", ")}`,
      );
    }

    const scope = normalizeVisibilityScope(input.visibilityScope);

    const card = await this.deps.cardRepository.create(userId, {
      cardName: trimmedName,
      cardType: normalizedType,
      visibilityScope: scope,
    });

    // Optional background sync to Resource if a matching catalog card exists
    if (this.deps.cardCatalogRepository && this.deps.resourceRepository) {
      try {
        const catalogCards = await this.deps.cardCatalogRepository.listCards();
        const lowerName = trimmedName.toLowerCase();
        const matched = catalogCards.find((c) => {
          const fullName = `${c.issuer} ${c.product_name}`.toLowerCase();
          return fullName === lowerName || c.product_name.toLowerCase() === lowerName;
        });

        if (matched) {
          await this.deps.resourceRepository.create({
            owner_id: userId,
            card_catalog_id: matched.id,
            visibility: scope === "TOTAL_NETWORK" ? "network" : "friends",
            request_enabled: true,
            notes: null,
          });
        }
      } catch {
        // Non-critical background sync
      }
    }

    return { card };
  }

  async listCards(targetUserId: string, viewerId?: string): Promise<{ cards: CardRecord[] }> {
    if (!targetUserId?.trim()) {
      throw new HttpError(400, "Target user ID is required");
    }

    const user = await this.deps.userRepository.findById(targetUserId);
    if (!user) {
      throw new HttpError(404, "User does not exist");
    }

    // If viewing own cards, return all
    if (!viewerId || viewerId === targetUserId) {
      const cards = await this.deps.cardRepository.listByUser(targetUserId);
      return { cards };
    }

    // Visibility rules enforcement for other viewers
    if (this.deps.connectionRepository) {
      const isBlocked = await this.deps.connectionRepository.isUserBlocked(viewerId, targetUserId);
      if (isBlocked) {
        return { cards: [] };
      }

      // Check if direct friend (depth 1)
      const directConn = await this.deps.connectionRepository.findActiveBetweenUsers(viewerId, targetUserId);
      if (directConn && directConn.status === "accepted") {
        // First-degree connections see both DIRECT_FRIENDS and TOTAL_NETWORK
        const cards = await this.deps.cardRepository.listByUser(targetUserId, ["DIRECT_FRIENDS", "TOTAL_NETWORK"]);
        return { cards };
      }

      // Check if friend of friend (depth 2)
      const mutualFriends = await this.deps.connectionRepository.findMutualFriendNames(viewerId, targetUserId);
      if (mutualFriends.length > 0) {
        // Second-degree connections only see TOTAL_NETWORK
        const cards = await this.deps.cardRepository.listByUser(targetUserId, ["TOTAL_NETWORK"]);
        return { cards };
      }

      // Not connected at all: 0 cards visible
      return { cards: [] };
    }

    const cards = await this.deps.cardRepository.listByUser(targetUserId);
    return { cards };
  }

  async getCard(userId: string, cardId: string): Promise<{ card: CardRecord }> {
    if (!userId?.trim()) {
      throw new HttpError(401, "Authentication required");
    }

    const card = await this.deps.cardRepository.findById(cardId);
    if (!card) {
      throw new HttpError(404, "Card not found");
    }

    if (card.userId !== userId) {
      if (this.deps.connectionRepository) {
        const isBlocked = await this.deps.connectionRepository.isUserBlocked(userId, card.userId);
        if (isBlocked) {
          throw new HttpError(403, "Access denied");
        }
        const directConn = await this.deps.connectionRepository.findActiveBetweenUsers(userId, card.userId);
        const isDirect = directConn && directConn.status === "accepted";
        if (isDirect) {
          return { card };
        }
        const mutualFriends = await this.deps.connectionRepository.findMutualFriendNames(userId, card.userId);
        const isFoF = mutualFriends.length > 0;
        if (isFoF && card.visibilityScope === "TOTAL_NETWORK") {
          return { card };
        }
      }
      throw new HttpError(403, "Access denied");
    }

    return { card };
  }

  async updateCard(
    userId: string,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<{ card: CardRecord }> {
    if (!userId?.trim()) {
      throw new HttpError(401, "Authentication required");
    }

    const card = await this.deps.cardRepository.findById(cardId);
    if (!card) {
      throw new HttpError(404, "Card not found");
    }

    if (card.userId !== userId) {
      throw new HttpError(403, "Access denied: you can only edit your own cards");
    }

    const updateData: UpdateCardInput = {};

    if (input.cardName !== undefined) {
      const trimmed = input.cardName.trim();
      if (!trimmed) {
        throw new HttpError(400, "Card name cannot be empty");
      }
      if (trimmed.length > 100) {
        throw new HttpError(400, "Card name must be 100 characters or fewer");
      }
      updateData.cardName = trimmed;
    }

    if (input.cardType !== undefined) {
      const normalizedType = normalizeCardType(input.cardType);
      if (!normalizedType) {
        throw new HttpError(
          400,
          `Invalid card type. Supported types: ${SUPPORTED_CARD_TYPES.join(", ")}`,
        );
      }
      updateData.cardType = normalizedType;
    }

    if (input.visibilityScope !== undefined) {
      updateData.visibilityScope = normalizeVisibilityScope(input.visibilityScope);
    }

    const updated = await this.deps.cardRepository.update(cardId, updateData);
    return { card: updated };
  }

  async deleteCard(userId: string, cardId: string): Promise<void> {
    if (!userId?.trim()) {
      throw new HttpError(401, "Authentication required");
    }

    const card = await this.deps.cardRepository.findById(cardId);
    if (!card) {
      throw new HttpError(404, "Card not found");
    }

    if (card.userId !== userId) {
      throw new HttpError(403, "Access denied: you can only delete your own cards");
    }

    await this.deps.cardRepository.delete(cardId);
  }
}
