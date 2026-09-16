import type { Connection, PrismaClient } from "@prisma/client";

import { HttpError } from "../errors/http-error.js";

import type {
  ActiveConnectionStatus,
  ConnectionRecord,
  ConnectionStatus,
  CreateConnectionRecordInput,
} from "./connection.types.js";

const ACTIVE_CONNECTION_STATUSES: ConnectionStatus[] = ["pending", "accepted", "blocked"];

interface ConnectionRepository {
  findById(id: string): Promise<ConnectionRecord | null>;
  findActiveBetweenUsers(firstUserId: string, secondUserId: string): Promise<ConnectionRecord | null>;
  create(input: CreateConnectionRecordInput): Promise<ConnectionRecord>;
  updateStatus(id: string, status: ConnectionStatus): Promise<ConnectionRecord>;
  listByUser(userId: string, status?: ConnectionStatus): Promise<ConnectionRecord[]>;
}

class PrismaConnectionRepository implements ConnectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<ConnectionRecord | null> {
    const connection = await this.prisma.connection.findUnique({
      where: { id },
    });

    return connection ? mapPrismaConnection(connection) : null;
  }

  async findActiveBetweenUsers(firstUserId: string, secondUserId: string): Promise<ConnectionRecord | null> {
    const connection = await this.prisma.connection.findFirst({
      where: {
        status: {
          in: ACTIVE_CONNECTION_STATUSES,
        },
        OR: [
          {
            requester_id: firstUserId,
            addressee_id: secondUserId,
          },
          {
            requester_id: secondUserId,
            addressee_id: firstUserId,
          },
        ],
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return connection ? mapPrismaConnection(connection) : null;
  }

  async create(input: CreateConnectionRecordInput): Promise<ConnectionRecord> {
    try {
      const connection = await this.prisma.connection.create({
        data: {
          requester_id: input.requester_id,
          addressee_id: input.addressee_id,
          active_pair_key: buildActivePairKey(input.requester_id, input.addressee_id, input.status),
          status: input.status,
        },
      });

      return mapPrismaConnection(connection);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new HttpError(409, "An active connection already exists between these users");
      }

      throw error;
    }
  }

  async updateStatus(id: string, status: ConnectionStatus): Promise<ConnectionRecord> {
    const connection = await this.prisma.connection.update({
      where: { id },
      data: {
        status,
        ...(status === "removed" ? { active_pair_key: null } : {}),
      },
    });

    return mapPrismaConnection(connection);
  }

  async listByUser(userId: string, status?: ConnectionStatus): Promise<ConnectionRecord[]> {
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [
          { requester_id: userId },
          { addressee_id: userId },
        ],
        ...(status ? { status } : { status: { not: "removed" } }),
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return connections.map(mapPrismaConnection);
  }
}

class InMemoryConnectionRepository implements ConnectionRepository {
  private readonly connectionsById = new Map<string, ConnectionRecord>();
  private nextId = 1;

  async findById(id: string): Promise<ConnectionRecord | null> {
    return this.connectionsById.get(id) ?? null;
  }

  async findActiveBetweenUsers(firstUserId: string, secondUserId: string): Promise<ConnectionRecord | null> {
    const matches = [...this.connectionsById.values()]
      .filter((connection) => ACTIVE_CONNECTION_STATUSES.includes(connection.status))
      .filter((connection) => isSamePair(connection, firstUserId, secondUserId))
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());

    return matches[0] ?? null;
  }

  async create(input: CreateConnectionRecordInput): Promise<ConnectionRecord> {
    const now = new Date();
    const connection: ConnectionRecord = {
      id: `connection-${this.nextId++}`,
      requester_id: input.requester_id,
      addressee_id: input.addressee_id,
      status: input.status,
      created_at: now,
      updated_at: now,
    };

    this.connectionsById.set(connection.id, connection);

    return connection;
  }

  async updateStatus(id: string, status: ConnectionStatus): Promise<ConnectionRecord> {
    const existing = this.connectionsById.get(id);

    if (!existing) {
      throw new Error(`Connection ${id} not found`);
    }

    const updated: ConnectionRecord = {
      ...existing,
      status,
      updated_at: new Date(),
    };

    this.connectionsById.set(id, updated);

    return updated;
  }

  async listByUser(userId: string, status?: ConnectionStatus): Promise<ConnectionRecord[]> {
    return [...this.connectionsById.values()]
      .filter((connection) => connection.requester_id === userId || connection.addressee_id === userId)
      .filter((connection) => (status ? connection.status === status : connection.status !== "removed"))
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
  }
}

function isSamePair(connection: ConnectionRecord, firstUserId: string, secondUserId: string): boolean {
  return (
    (connection.requester_id === firstUserId && connection.addressee_id === secondUserId)
    || (connection.requester_id === secondUserId && connection.addressee_id === firstUserId)
  );
}

function mapPrismaConnection(connection: Connection): ConnectionRecord {
  return {
    id: connection.id,
    requester_id: connection.requester_id,
    addressee_id: connection.addressee_id,
    status: parseConnectionStatus(connection.status),
    created_at: connection.created_at,
    updated_at: connection.updated_at,
  };
}

function parseConnectionStatus(status: string): ConnectionRecord["status"] {
  if (ACTIVE_CONNECTION_STATUSES.includes(status as ActiveConnectionStatus) || status === "removed") {
    return status as ConnectionRecord["status"];
  }

  throw new Error(`Unexpected connection status: ${status}`);
}

function buildActivePairKey(
  requesterId: string,
  addresseeId: string,
  status: ConnectionStatus,
): string | null {
  if (status === "removed") {
    return null;
  }

  const [firstUserId, secondUserId] = [requesterId, addresseeId].sort();
  return `${firstUserId}:${secondUserId}`;
}

function isPrismaUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export { InMemoryConnectionRepository, PrismaConnectionRepository };
export type { ConnectionRepository };
