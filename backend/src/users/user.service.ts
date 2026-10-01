import { HttpError } from "../errors/http-error.js";

import { toPublicUserProfile, toUserProfile } from "./user.types.js";
import type { PublicUserProfile, SyncUserInput, UserProfile, UserRecord } from "./user.types.js";
import type { UserRepository } from "./user.repository.js";

const DISPLAY_NAME_MAX_LENGTH = 80;

type UserServiceDependencies = {
  userRepository: UserRepository;
};

class UserService {
  private readonly userRepository: UserRepository;

  constructor({ userRepository }: UserServiceDependencies) {
    this.userRepository = userRepository;
  }

  async syncProfile(input: SyncUserInput): Promise<UserProfile> {
    const authUserId = input.auth_user_id.trim();

    if (!authUserId) {
      throw new HttpError(401, "Authenticated user id is required");
    }

    const existingUser = await this.userRepository.findById(authUserId);
    const email = resolveEmail(input, existingUser);
    const displayName = resolveDisplayName(input, existingUser);

    if (!email) {
      throw new HttpError(400, "email is required");
    }

    if (!displayName) {
      throw new HttpError(400, "display_name is required");
    }

    const user = await this.userRepository.upsertProfile({
      id: authUserId,
      email,
      phone: input.phone !== undefined ? input.phone : existingUser?.phone ?? null,
      display_name: displayName,
      status: existingUser?.status ?? "active",
    });

    return toUserProfile(user);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    if (!userId.trim()) {
      throw new HttpError(400, "user id is required");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    return toUserProfile(user);
  }

  async getPublicProfile(userId: string): Promise<PublicUserProfile> {
    if (!userId.trim()) {
      throw new HttpError(400, "user id is required");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    return toPublicUserProfile(user);
  }
}

function resolveEmail(input: SyncUserInput, existingUser: UserRecord | null): string | null {
  const emailCandidates = [input.auth_email, input.email, existingUser?.email];

  for (const candidate of emailCandidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim().toLowerCase();
    }
  }

  return null;
}

function resolveDisplayName(input: SyncUserInput, existingUser: UserRecord | null): string | null {
  const displayNameCandidates = [
    input.display_name,
    existingUser?.display_name,
    readMetadataDisplayName(input.auth_user_metadata),
  ];

  for (const candidate of displayNameCandidates) {
    const normalizedDisplayName = normalizeDisplayName(candidate);

    if (normalizedDisplayName) {
      return normalizedDisplayName;
    }
  }

  return null;
}

function readMetadataDisplayName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) {
    return null;
  }

  const keys = ["display_name", "full_name", "name", "preferred_username"] as const;

  for (const key of keys) {
    const value = metadata[key];

    const normalizedDisplayName = normalizeDisplayName(value);

    if (normalizedDisplayName) {
      return normalizedDisplayName;
    }
  }

  return null;
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue === "" || normalizedValue.length > DISPLAY_NAME_MAX_LENGTH) {
    return null;
  }

  return normalizedValue;
}

export { UserService };
