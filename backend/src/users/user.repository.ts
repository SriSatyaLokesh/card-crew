import { HttpError } from "../errors/http-error.js";

import type { PrismaClient, User } from "@prisma/client";

import type { UpsertUserRecordInput, UserRecord } from "./user.types.js";

interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  upsertProfile(input: UpsertUserRecordInput): Promise<UserRecord>;
}

class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? mapPrismaUser(user) : null;
  }

  async upsertProfile(input: UpsertUserRecordInput): Promise<UserRecord> {
    try {
      const user = await this.prisma.user.upsert({
        where: { id: input.id },
        update: {
          email: input.email,
          phone: input.phone ?? null,
          display_name: input.display_name,
        },
        create: {
          id: input.id,
          email: input.email,
          phone: input.phone ?? null,
          display_name: input.display_name,
          status: input.status ?? "active",
        },
      });

      return mapPrismaUser(user);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new HttpError(409, "A user with that email or phone already exists");
      }

      throw error;
    }
  }
}

class InMemoryUserRepository implements UserRepository {
  private readonly usersById = new Map<string, UserRecord>();
  private readonly userIdsByEmail = new Map<string, string>();
  private readonly userIdsByPhone = new Map<string, string>();

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async upsertProfile(input: UpsertUserRecordInput): Promise<UserRecord> {
    const existingUser = this.usersById.get(input.id) ?? null;

    this.assertUniqueEmail(input.email, input.id);
    this.assertUniquePhone(input.phone ?? null, input.id);

    const now = new Date();
    const user: UserRecord = existingUser
      ? {
          ...existingUser,
          email: input.email,
          phone: input.phone ?? null,
          display_name: input.display_name,
          updated_at: now,
        }
      : {
          id: input.id,
          email: input.email,
          phone: input.phone ?? null,
          display_name: input.display_name,
          status: input.status ?? "active",
          created_at: now,
          updated_at: now,
        };

    if (existingUser) {
      this.userIdsByEmail.delete(existingUser.email);

      if (existingUser.phone) {
        this.userIdsByPhone.delete(existingUser.phone);
      }
    }

    this.usersById.set(user.id, user);
    this.userIdsByEmail.set(user.email, user.id);

    if (user.phone) {
      this.userIdsByPhone.set(user.phone, user.id);
    }

    return user;
  }

  private assertUniqueEmail(email: string, currentUserId: string): void {
    const existingUserId = this.userIdsByEmail.get(email);

    if (existingUserId && existingUserId !== currentUserId) {
      throw new HttpError(409, "A user with that email or phone already exists");
    }
  }

  private assertUniquePhone(phone: string | null, currentUserId: string): void {
    if (!phone) {
      return;
    }

    const existingUserId = this.userIdsByPhone.get(phone);

    if (existingUserId && existingUserId !== currentUserId) {
      throw new HttpError(409, "A user with that email or phone already exists");
    }
  }
}

function mapPrismaUser(user: User): UserRecord {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    display_name: user.display_name,
    status: parseUserStatus(user.status),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function parseUserStatus(status: string): UserRecord["status"] {
  if (status === "active" || status === "blocked" || status === "deleted") {
    return status;
  }

  throw new Error(`Unexpected user status: ${status}`);
}

function isPrismaUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export { InMemoryUserRepository, PrismaUserRepository };
export type { UserRepository };
