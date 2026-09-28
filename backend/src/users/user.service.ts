import { HttpError } from "../errors/http-error.js";

import { toPublicUserProfile, toUserProfile } from "./user.types.js";
import type { PublicUserProfile, SyncUserInput, UserProfile, UserRecord } from "./user.types.js";
import type { UserRepository } from "./user.repository.js";

import type { ConnectionRepository } from "../connections/connection.repository.js";

const DISPLAY_NAME_MAX_LENGTH = 80;

export type NetworkUserSearchResult = {
  id: string;
  display_name: string;
  email?: string;
  status: string;
  relationship: "direct_friend" | "friend_of_friend" | "incoming_request" | "outgoing_request" | "blocked" | "none";
  mutual_friend_name?: string | null;
  mutual_friend_count?: number;
  connection_id?: string | null;
  avatar_url?: string | null;
};

type UserServiceDependencies = {
  userRepository: UserRepository;
  connectionRepository?: ConnectionRepository;
};

class UserService {
  private readonly userRepository: UserRepository;
  private readonly connectionRepository?: ConnectionRepository;

  constructor({ userRepository, connectionRepository }: UserServiceDependencies) {
    this.userRepository = userRepository;
    this.connectionRepository = connectionRepository;
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

  async searchUsers(query: string, currentUserId?: string): Promise<PublicUserProfile[]> {
    const users = await this.userRepository.searchByName(query, currentUserId);
    return users.map(toPublicUserProfile);
  }

  async searchUsersWithRelationships(
    query: string,
    currentUserId?: string,
  ): Promise<NetworkUserSearchResult[]> {
    const users = await this.userRepository.searchByName(query, currentUserId);

    if (!currentUserId || !this.connectionRepository) {
      return users.map((u) => ({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        status: u.status,
        relationship: "none",
        avatar_url: u.avatar_url ?? null,
      }));
    }

    const results: NetworkUserSearchResult[] = [];

    for (const candidate of users) {
      // 1. Check if blocked
      const isBlocked = await this.connectionRepository.isUserBlocked(currentUserId, candidate.id);
      if (isBlocked) {
        results.push({
          id: candidate.id,
          display_name: candidate.display_name,
          email: candidate.email,
          status: candidate.status,
          relationship: "blocked",
          avatar_url: candidate.avatar_url ?? null,
        });
        continue;
      }

      // 2. Check direct connection
      const connection = await this.connectionRepository.findActiveBetweenUsers(
        currentUserId,
        candidate.id,
      );

      if (connection) {
        if (connection.status === "accepted") {
          results.push({
            id: candidate.id,
            display_name: candidate.display_name,
            email: candidate.email,
            status: candidate.status,
            relationship: "direct_friend",
            connection_id: connection.id,
            avatar_url: candidate.avatar_url ?? null,
          });
          continue;
        }

        if (connection.status === "pending") {
          results.push({
            id: candidate.id,
            display_name: candidate.display_name,
            email: candidate.email,
            status: candidate.status,
            relationship: connection.requester_id === currentUserId ? "outgoing_request" : "incoming_request",
            connection_id: connection.id,
            avatar_url: candidate.avatar_url ?? null,
          });
          continue;
        }
      }

      // 3. Check Friends of Friends (mutual friends calculated from DB!)
      const mutualFriendNames = await this.connectionRepository.findMutualFriendNames(
        currentUserId,
        candidate.id,
      );

      if (mutualFriendNames.length > 0) {
        results.push({
          id: candidate.id,
          display_name: candidate.display_name,
          email: candidate.email,
          status: candidate.status,
          relationship: "friend_of_friend",
          mutual_friend_name: mutualFriendNames[0],
          mutual_friend_count: mutualFriendNames.length,
          avatar_url: candidate.avatar_url ?? null,
        });
        continue;
      }

      // 4. Default: other user in network
      results.push({
        id: candidate.id,
        display_name: candidate.display_name,
        email: candidate.email,
        status: candidate.status,
        relationship: "none",
        avatar_url: candidate.avatar_url ?? null,
      });
    }

    return results;
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
