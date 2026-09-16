import type { ConnectionRecord } from "../connections/connection.types.js";
import { HttpError } from "../errors/http-error.js";

import type { PrismaClient, Resource } from "@prisma/client";

import type { CreateResourceInput, ResourceRecord, ResourceStatus, ResourceVisibility, UpdateResourceInput } from "./resource.types.js";

interface ResourceRepository {
  create(input: CreateResourceInput): Promise<ResourceRecord>;
  listAll(): Promise<ResourceRecord[]>;
  listByOwner(ownerId: string): Promise<ResourceRecord[]>;
  findById(id: string): Promise<ResourceRecord | null>;
  update(id: string, input: UpdateResourceInput): Promise<ResourceRecord>;
  delete(id: string): Promise<void>;
}

class PrismaResourceRepository implements ResourceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateResourceInput): Promise<ResourceRecord> {
    const resource = await this.prisma.resource.create({
      data: {
        owner_id: input.owner_id,
        card_catalog_id: input.card_catalog_id,
        visibility: input.visibility ?? "friends",
        request_enabled: input.request_enabled ?? true,
        notes: input.notes ?? null,
      },
    });

    return mapPrismaResource(resource);
  }

  async listAll(): Promise<ResourceRecord[]> {
    const resources = await this.prisma.resource.findMany({
      where: { status: { not: "removed" } },
      orderBy: { created_at: "desc" },
    });

    return resources.map(mapPrismaResource);
  }

  async listByOwner(ownerId: string): Promise<ResourceRecord[]> {
    const resources = await this.prisma.resource.findMany({
      where: { owner_id: ownerId, status: { not: "removed" } },
      orderBy: { created_at: "desc" },
    });

    return resources.map(mapPrismaResource);
  }

  async findById(id: string): Promise<ResourceRecord | null> {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    return resource ? mapPrismaResource(resource) : null;
  }

  async update(id: string, input: UpdateResourceInput): Promise<ResourceRecord> {
    try {
      const resource = await this.prisma.resource.update({
        where: { id },
        data: {
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.request_enabled !== undefined ? { request_enabled: input.request_enabled } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });

      return mapPrismaResource(resource);
    } catch (error) {
      if (isPrismaNotFoundError(error)) {
        throw new HttpError(404, "Resource not found");
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.resource.update({ where: { id }, data: { status: "removed" } });
    } catch (error) {
      if (isPrismaNotFoundError(error)) {
        throw new HttpError(404, "Resource not found");
      }

      throw error;
    }
  }
}

class InMemoryResourceRepository implements ResourceRepository {
  private readonly resourcesById = new Map<string, ResourceRecord>();
  private nextId = 1;

  async create(input: CreateResourceInput): Promise<ResourceRecord> {
    const now = new Date();
    const resource: ResourceRecord = {
      id: `resource-${this.nextId++}`,
      owner_id: input.owner_id,
      card_catalog_id: input.card_catalog_id,
      visibility: input.visibility ?? "friends",
      request_enabled: input.request_enabled ?? true,
      notes: input.notes ?? null,
      status: "active",
      created_at: now,
      updated_at: now,
    };

    this.resourcesById.set(resource.id, resource);
    return resource;
  }

  async listAll(): Promise<ResourceRecord[]> {
    return [...this.resourcesById.values()]
      .filter((resource) => resource.status !== "removed")
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
  }

  async listByOwner(ownerId: string): Promise<ResourceRecord[]> {
    return [...this.resourcesById.values()]
      .filter((resource) => resource.owner_id === ownerId && resource.status !== "removed")
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
  }

  async findById(id: string): Promise<ResourceRecord | null> {
    return this.resourcesById.get(id) ?? null;
  }

  async update(id: string, input: UpdateResourceInput): Promise<ResourceRecord> {
    const existing = this.resourcesById.get(id);

    if (!existing) {
      throw new HttpError(404, "Resource not found");
    }

    const updated: ResourceRecord = {
      ...existing,
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.request_enabled !== undefined ? { request_enabled: input.request_enabled } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updated_at: new Date(),
    };

    this.resourcesById.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = this.resourcesById.get(id);

    if (!existing) {
      throw new HttpError(404, "Resource not found");
    }

    this.resourcesById.set(id, { ...existing, status: "removed", updated_at: new Date() });
  }
}

function mapPrismaResource(resource: Resource): ResourceRecord {
  return {
    id: resource.id,
    owner_id: resource.owner_id,
    card_catalog_id: resource.card_catalog_id,
    visibility: resource.visibility as ResourceVisibility,
    request_enabled: resource.request_enabled,
    notes: resource.notes,
    status: resource.status as ResourceStatus,
    created_at: resource.created_at,
    updated_at: resource.updated_at,
  };
}

function isPrismaNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

function toResourceSummary(resource: ResourceRecord) {
  return {
    id: resource.id,
    owner_id: resource.owner_id,
    card_catalog_id: resource.card_catalog_id,
    visibility: resource.visibility,
    request_enabled: resource.request_enabled,
    notes: resource.notes,
    status: resource.status,
    created_at: resource.created_at.toISOString(),
    updated_at: resource.updated_at.toISOString(),
  };
}

function resourceIsRequestable(resource: ResourceRecord, connectionStatus?: ConnectionRecord["status"]): boolean {
  if (!resource.request_enabled || resource.status !== "active") {
    return false;
  }

  if (resource.visibility === "private") {
    return false;
  }

  if (resource.visibility === "friends") {
    return connectionStatus === "accepted" || connectionStatus === "pending";
  }

  return true;
}

export { InMemoryResourceRepository, PrismaResourceRepository, resourceIsRequestable, toResourceSummary };
export type { ResourceRepository };
export type { ResourceStatus, ResourceVisibility };
