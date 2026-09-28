import type { Connection, PrismaClient } from "@prisma/client";

import { HttpError } from "../errors/http-error.js";

import type {
  ActiveConnectionStatus,
  BlockedUserRecord,
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
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  listBlockedByUser(userId: string): Promise<BlockedUserRecord[]>;
  listBlockedMe(userId: string): Promise<BlockedUserRecord[]>;
  countBlockedMe(userId: string): Promise<number>;
  isUserBlocked(userA: string, userB: string): Promise<boolean>;
  findMutualFriendNames(userA: string, userB: string): Promise<string[]>;
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

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userBlock.upsert({
        where: {
          blocker_id_blocked_id: {
            blocker_id: blockerId,
            blocked_id: blockedId,
          },
        },
        create: {
          blocker_id: blockerId,
          blocked_id: blockedId,
        },
        update: {},
      });

      await tx.connection.updateMany({
        where: {
          status: { in: ["accepted", "pending", "blocked"] },
          OR: [
            { requester_id: blockerId, addressee_id: blockedId },
            { requester_id: blockedId, addressee_id: blockerId },
          ],
        },
        data: {
          status: "removed",
          active_pair_key: null,
        },
      });
    });
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.userBlock.deleteMany({
      where: {
        blocker_id: blockerId,
        blocked_id: blockedId,
      },
    });
  }

  async listBlockedByUser(userId: string): Promise<BlockedUserRecord[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blocker_id: userId },
      include: {
        blocked: {
          select: { id: true, display_name: true, email: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return blocks.map((b) => ({
      id: b.id,
      blocker_id: b.blocker_id,
      blocked_id: b.blocked_id,
      user: {
        id: b.blocked.id,
        display_name: b.blocked.display_name,
        email: b.blocked.email,
      },
      created_at: b.created_at,
    }));
  }

  async listBlockedMe(userId: string): Promise<BlockedUserRecord[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blocked_id: userId },
      include: {
        blocker: {
          select: { id: true, display_name: true, email: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return blocks.map((b) => ({
      id: b.id,
      blocker_id: b.blocker_id,
      blocked_id: b.blocked_id,
      user: {
        id: b.blocker.id,
        display_name: b.blocker.display_name,
        email: b.blocker.email,
      },
      created_at: b.created_at,
    }));
  }

  async countBlockedMe(userId: string): Promise<number> {
    return this.prisma.userBlock.count({
      where: { blocked_id: userId },
    });
  }

  async isUserBlocked(userA: string, userB: string): Promise<boolean> {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blocker_id: userA, blocked_id: userB },
          { blocker_id: userB, blocked_id: userA },
        ],
      },
    });

    return !!block;
  }

  async findMutualFriendNames(userA: string, userB: string): Promise<string[]> {
    const [connectionsA, connectionsB] = await Promise.all([
      this.listByUser(userA, "accepted"),
      this.listByUser(userB, "accepted"),
    ]);

    const friendsOfA = new Set(
      connectionsA.map((c) => (c.requester_id === userA ? c.addressee_id : c.requester_id)),
    );
    const friendsOfB = new Set(
      connectionsB.map((c) => (c.requester_id === userB ? c.addressee_id : c.requester_id)),
    );

    const mutualIds = [...friendsOfA].filter((id) => friendsOfB.has(id));
    if (mutualIds.length === 0) {
      return [];
    }

    const mutualUsers = await this.prisma.user.findMany({
      where: { id: { in: mutualIds } },
      select: { display_name: true },
    });

    return mutualUsers.map((u) => u.display_name);
  }
}

class InMemoryConnectionRepository implements ConnectionRepository {
  private readonly connectionsById = new Map<string, ConnectionRecord>();
  private readonly blocks: Array<{ id: string; blocker_id: string; blocked_id: string; created_at: Date }> = [];
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

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const existingIndex = this.blocks.findIndex(
      (b) => b.blocker_id === blockerId && b.blocked_id === blockedId,
    );
    if (existingIndex === -1) {
      this.blocks.push({
        id: `block-${this.blocks.length + 1}`,
        blocker_id: blockerId,
        blocked_id: blockedId,
        created_at: new Date(),
      });
    }

    for (const [id, connection] of this.connectionsById.entries()) {
      if (isSamePair(connection, blockerId, blockedId)) {
        this.connectionsById.set(id, {
          ...connection,
          status: "removed",
          updated_at: new Date(),
        });
      }
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const index = this.blocks.findIndex(
      (b) => b.blocker_id === blockerId && b.blocked_id === blockedId,
    );
    if (index !== -1) {
      this.blocks.splice(index, 1);
    }
  }

  async listBlockedByUser(userId: string): Promise<BlockedUserRecord[]> {
    return this.blocks
      .filter((b) => b.blocker_id === userId)
      .map((b) => ({
        id: b.id,
        blocker_id: b.blocker_id,
        blocked_id: b.blocked_id,
        user: {
          id: b.blocked_id,
          display_name: `User ${b.blocked_id.slice(0, 6)}`,
          email: `${b.blocked_id}@example.com`,
        },
        created_at: b.created_at,
      }));
  }

  async listBlockedMe(userId: string): Promise<BlockedUserRecord[]> {
    return this.blocks
      .filter((b) => b.blocked_id === userId)
      .map((b) => ({
        id: b.id,
        blocker_id: b.blocker_id,
        blocked_id: b.blocked_id,
        user: {
          id: b.blocker_id,
          display_name: `User ${b.blocker_id.slice(0, 6)}`,
          email: `${b.blocker_id}@example.com`,
        },
        created_at: b.created_at,
      }));
  }

  async countBlockedMe(userId: string): Promise<number> {
    return this.blocks.filter((b) => b.blocked_id === userId).length;
  }

  async isUserBlocked(userA: string, userB: string): Promise<boolean> {
    return this.blocks.some(
      (b) =>
        (b.blocker_id === userA && b.blocked_id === userB) ||
        (b.blocker_id === userB && b.blocked_id === userA),
    );
  }

  async findMutualFriendNames(_userA: string, _userB: string): Promise<string[]> {
    return [];
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
