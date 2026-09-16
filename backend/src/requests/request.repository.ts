import { HttpError } from "../errors/http-error.js";

import type { PrismaClient, Request as PrismaRequest } from "@prisma/client";

import type { CreateRequestInput, RequestRecord, ReferralStatus, UpdateReferralInput, RequestStatus, UpdateRequestInput } from "./request.types.js";

interface RequestRepository {
  create(input: CreateRequestInput): Promise<RequestRecord>;
  findById(id: string): Promise<RequestRecord | null>;
  listIncoming(ownerId: string): Promise<RequestRecord[]>;
  listOutgoing(requesterId: string): Promise<RequestRecord[]>;
  update(id: string, input: UpdateRequestInput): Promise<RequestRecord>;
  updateReferral(id: string, input: UpdateReferralInput): Promise<RequestRecord>;
  listReferral(intermediaryId: string): Promise<RequestRecord[]>;
}

class PrismaRequestRepository implements RequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateRequestInput): Promise<RequestRecord> {
    const request = await this.prisma.request.create({
      data: {
        requester_id: input.requester_id,
        owner_id: input.owner_id,
        resource_id: input.resource_id,
        intermediary_id: input.intermediary_id ?? null,
        message: input.message ?? "",
      },
    });

    return mapPrismaRequest(request);
  }

  async findById(id: string): Promise<RequestRecord | null> {
    const request = await this.prisma.request.findUnique({ where: { id } });
    return request ? mapPrismaRequest(request) : null;
  }

  async listIncoming(ownerId: string): Promise<RequestRecord[]> {
    const requests = await this.prisma.request.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: "desc" },
    });

    return requests.map(mapPrismaRequest);
  }

  async listOutgoing(requesterId: string): Promise<RequestRecord[]> {
    const requests = await this.prisma.request.findMany({
      where: { requester_id: requesterId },
      orderBy: { created_at: "desc" },
    });

    return requests.map(mapPrismaRequest);
  }

  async listReferral(intermediaryId: string): Promise<RequestRecord[]> {
    const requests = await this.prisma.request.findMany({ where: { intermediary_id: intermediaryId }, orderBy: { created_at: "desc" } });
    return requests.map(mapPrismaRequest);
  }

  async update(id: string, input: UpdateRequestInput): Promise<RequestRecord> {
    try {
      const request = await this.prisma.request.update({
        where: { id },
        data: { status: input.status, responded_at: new Date() },
      });

      return mapPrismaRequest(request);
    } catch (error) {
      if (isPrismaNotFoundError(error)) {
        throw new HttpError(404, "Request not found");
      }

      throw error;
    }
  }

  async updateReferral(id: string, input: UpdateReferralInput): Promise<RequestRecord> {
    try {
      const request = await this.prisma.request.update({ where: { id }, data: { referral_status: input.referral_status } });
      return mapPrismaRequest(request);
    } catch (error) {
      if (isPrismaNotFoundError(error)) throw new HttpError(404, "Request not found");
      throw error;
    }
  }
}

class InMemoryRequestRepository implements RequestRepository {
  private readonly requestsById = new Map<string, RequestRecord>();
  private nextId = 1;

  async create(input: CreateRequestInput): Promise<RequestRecord> {
    const now = new Date();
    const record: RequestRecord = {
      id: `request-${this.nextId++}`,
      requester_id: input.requester_id,
      owner_id: input.owner_id,
      resource_id: input.resource_id,
      intermediary_id: input.intermediary_id ?? null,
      message: input.message ?? "",
      status: "pending",
      referral_status: input.intermediary_id ? "pending" : "not_required",
      created_at: now,
      responded_at: null,
    };

    this.requestsById.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<RequestRecord | null> {
    return this.requestsById.get(id) ?? null;
  }

  async listIncoming(ownerId: string): Promise<RequestRecord[]> {
    return [...this.requestsById.values()]
      .filter((request) => request.owner_id === ownerId)
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
  }

  async listOutgoing(requesterId: string): Promise<RequestRecord[]> {
    return [...this.requestsById.values()]
      .filter((request) => request.requester_id === requesterId)
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
  }

  async listReferral(intermediaryId: string): Promise<RequestRecord[]> {
    return [...this.requestsById.values()].filter((request) => request.intermediary_id === intermediaryId).sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
  }

  async update(id: string, input: UpdateRequestInput): Promise<RequestRecord> {
    const existing = this.requestsById.get(id);
    if (!existing) {
      throw new HttpError(404, "Request not found");
    }

    const updated: RequestRecord = {
      ...existing,
      status: input.status,
      responded_at: new Date(),
    };

    this.requestsById.set(id, updated);
    return updated;
  }

  async updateReferral(id: string, input: UpdateReferralInput): Promise<RequestRecord> {
    const existing = this.requestsById.get(id);
    if (!existing) throw new HttpError(404, "Request not found");
    const updated = { ...existing, referral_status: input.referral_status };
    this.requestsById.set(id, updated);
    return updated;
  }
}

function mapPrismaRequest(request: PrismaRequest): RequestRecord {
  return {
    id: request.id,
    requester_id: request.requester_id,
    owner_id: request.owner_id,
    resource_id: request.resource_id,
    intermediary_id: request.intermediary_id,
    message: request.message,
    status: request.status as RequestStatus,
    referral_status: request.referral_status as ReferralStatus,
    created_at: request.created_at,
    responded_at: request.responded_at,
  };
}

function isPrismaNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

function toRequestSummary(request: RequestRecord) {
  return {
    id: request.id,
    requester_id: request.requester_id,
    owner_id: request.owner_id,
    resource_id: request.resource_id,
    intermediary_id: request.intermediary_id,
    message: request.message,
    status: request.status,
    referral_status: request.referral_status,
    created_at: request.created_at.toISOString(),
    responded_at: request.responded_at?.toISOString() ?? null,
  };
}

export { InMemoryRequestRepository, PrismaRequestRepository, toRequestSummary };
export type { RequestRepository, RequestStatus };
