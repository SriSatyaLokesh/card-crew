import { HttpError } from "../errors/http-error.js";
import type { ConnectionRepository } from "../connections/connection.repository.js";
import type { CardCatalogRepository } from "../catalog/card-catalog.repository.js";
import type { UserRepository } from "../users/user.repository.js";

import { assertCatalogCardExists } from "../catalog/card-catalog.repository.js";
import { toResourceSummary } from "./resource.repository.js";
import type { CreateResourceInput, ResourceRecord, ResourceVisibility, UpdateResourceInput } from "./resource.types.js";
import type { ResourceRepository } from "./resource.repository.js";

const VALID_VISIBILITY: ResourceVisibility[] = ["private", "friends", "network"];

type ResourceServiceDependencies = {
  resourceRepository: ResourceRepository;
  userRepository: UserRepository;
  cardCatalogRepository: CardCatalogRepository;
  connectionRepository: ConnectionRepository;
};

class ResourceService {
  constructor(private readonly deps: ResourceServiceDependencies) {}

  async create(input: CreateResourceInput) {
    await this.assertUserExists(input.owner_id);
    const catalogCard = await this.deps.cardCatalogRepository.findById(input.card_catalog_id);
    assertCatalogCardExists(catalogCard, input.card_catalog_id);

    if (input.visibility !== undefined && !VALID_VISIBILITY.includes(input.visibility)) {
      throw new HttpError(400, "visibility must be one of: private, friends, network");
    }

    const resource = await this.deps.resourceRepository.create({
      owner_id: input.owner_id,
      card_catalog_id: input.card_catalog_id,
      visibility: input.visibility ?? "friends",
      request_enabled: input.request_enabled ?? true,
      notes: input.notes ?? null,
    });

    return { resource: toResourceSummary(resource) };
  }

  async list(userId: string) {
    await this.assertUserExists(userId);
    const resources = await this.deps.resourceRepository.listByOwner(userId);
    return { resources: resources.map(toResourceSummary) };
  }

  async getById(id: string, viewerId: string) {
    const resource = await this.deps.resourceRepository.findById(id);
    if (!resource) {
      throw new HttpError(404, "Resource not found");
    }

    await this.assertCanView(resource, viewerId);
    return { resource: toResourceSummary(resource) };
  }

  async update(id: string, actorId: string, input: UpdateResourceInput) {
    const resource = await this.deps.resourceRepository.findById(id);
    if (!resource) {
      throw new HttpError(404, "Resource not found");
    }

    this.assertOwner(resource, actorId);

    if (input.visibility !== undefined && !VALID_VISIBILITY.includes(input.visibility)) {
      throw new HttpError(400, "visibility must be one of: private, friends, network");
    }

    const updated = await this.deps.resourceRepository.update(id, input);
    return { resource: toResourceSummary(updated) };
  }

  async delete(id: string, actorId: string) {
    const resource = await this.deps.resourceRepository.findById(id);
    if (!resource) {
      throw new HttpError(404, "Resource not found");
    }

    this.assertOwner(resource, actorId);
    await this.deps.resourceRepository.delete(id);
  }

  async findNetworkMatchesForCard(userId: string, cardCatalogId: string, maxDepth = 1) {
    await this.assertUserExists(userId);
    if (maxDepth !== 1 && maxDepth !== 2) {
      throw new HttpError(400, "depth must be 1 or 2");
    }
    const catalogCard = await this.deps.cardCatalogRepository.findById(cardCatalogId);
    assertCatalogCardExists(catalogCard, cardCatalogId);

    const matchesByUser = new Map<string, {
      user_id: string;
      resource_id: string;
      relationship: string;
      depth: 1 | 2;
      via_user_id: string | null;
      requestable: boolean;
    }>();
    const allResources = await this.deps.resourceRepository.listAll();
    const reachable = await this.findReachableUsers(userId, maxDepth);

    for (const resource of allResources) {
      if (resource.owner_id === userId || resource.card_catalog_id !== cardCatalogId || resource.status !== "active") {
        continue;
      }

      const relation = reachable.get(resource.owner_id);
      if (!relation || resource.visibility === "private" || (relation.depth === 2 && resource.visibility !== "network")) {
        continue;
      }

      const payload = {
        user_id: resource.owner_id,
        resource_id: resource.id,
        relationship: relation.depth === 1 ? "direct" : "second-degree",
        depth: relation.depth,
        via_user_id: relation.via_user_id,
        requestable: resource.request_enabled && relation.depth === 1,
      };

      matchesByUser.set(resource.owner_id, payload);
    }

    return { resource: catalogCard.product_name, matches: [...matchesByUser.values()] };
  }

  private async findReachableUsers(userId: string, maxDepth: 1 | 2) {
    const reachable = new Map<string, { depth: 1 | 2; via_user_id: string | null }>();
    let frontier = [userId];

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const nextFrontier: string[] = [];
      for (const currentUserId of frontier) {
        const connections = await this.deps.connectionRepository.listByUser(currentUserId, "accepted");
        for (const connection of connections) {
          const neighborId = connection.requester_id === currentUserId
            ? connection.addressee_id
            : connection.requester_id;
          if (neighborId === userId || reachable.has(neighborId)) {
            continue;
          }
          reachable.set(neighborId, { depth: depth as 1 | 2, via_user_id: depth === 2 ? currentUserId : null });
          nextFrontier.push(neighborId);
        }
      }
      frontier = nextFrontier;
    }

    return reachable;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
  }

  private assertOwner(resource: ResourceRecord, actorId: string): void {
    if (resource.owner_id !== actorId) {
      throw new HttpError(403, "Only the resource owner can modify this resource");
    }
  }

  private async assertCanView(resource: ResourceRecord, viewerId: string): Promise<void> {
    await this.assertUserExists(viewerId);

    if (resource.owner_id === viewerId) {
      return;
    }

    if (resource.visibility === "private") {
      throw new HttpError(403, "This resource is private");
    }

    const connection = await this.deps.connectionRepository.findActiveBetweenUsers(viewerId, resource.owner_id);
    if (!connection || connection.status !== "accepted") {
      throw new HttpError(403, "Only direct friends can view this resource");
    }
  }
}

export { ResourceService };
