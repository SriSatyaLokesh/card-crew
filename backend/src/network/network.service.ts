import { HttpError } from "../errors/http-error.js";
import type { ConnectionRepository } from "../connections/connection.repository.js";
import type { UserRepository } from "../users/user.repository.js";
import type { ResourceRepository } from "../resources/resource.repository.js";
import type { CardRepository } from "../cards/card.repository.js";

type NetworkNode = {
  user_id: string;
  display_name: string;
  depth: 0 | 1 | 2;
  relationship: "self" | "direct" | "second-degree";
  via_user_id: string | null;
  card_count: number;
  avatar_url?: string | null;
};

type NetworkEdge = {
  from_user_id: string;
  to_user_id: string;
  status: "accepted";
};

type NetworkGraph = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

export type NetworkStats = {
  totalRequests: number;
  directFriends: number;
  friendsOfFriends: number;
  incomingRequests: number;
  pendingRequests: number;
  blockedMe: number;
};

export type FriendOfFriendSummary = {
  id: string;
  display_name: string;
  email?: string;
  mutual_friend_name: string | null;
  mutual_friends_count: number;
  relationship: "friend_of_friend";
  avatar_url?: string | null;
};

type NetworkServiceDependencies = {
  connectionRepository: ConnectionRepository;
  userRepository: UserRepository;
  resourceRepository: ResourceRepository;
  cardRepository?: CardRepository;
};

class NetworkService {
  constructor(private readonly deps: NetworkServiceDependencies) {}

  async getStats(userId: string): Promise<NetworkStats> {
    await this.assertUserExists(userId);

    const [directConnections, pendingConnections, blockedMeCount, fofList] = await Promise.all([
      this.deps.connectionRepository.listByUser(userId, "accepted"),
      this.deps.connectionRepository.listByUser(userId, "pending"),
      this.deps.connectionRepository.countBlockedMe(userId),
      this.getFriendsOfFriends(userId),
    ]);

    const incomingRequests = pendingConnections.filter((c) => c.addressee_id === userId).length;
    const pendingRequests = pendingConnections.filter((c) => c.requester_id === userId).length;
    const totalRequests = incomingRequests + pendingRequests;
    const directFriends = directConnections.length;
    const friendsOfFriends = fofList.length;

    return {
      totalRequests,
      directFriends,
      friendsOfFriends,
      incomingRequests,
      pendingRequests,
      blockedMe: blockedMeCount,
    };
  }

  async getFriendsOfFriends(userId: string): Promise<FriendOfFriendSummary[]> {
    await this.assertUserExists(userId);

    const myConnections = await this.deps.connectionRepository.listByUser(userId, "accepted");
    const directFriendIds = new Set<string>();
    const directFriendNames = new Map<string, string>();

    for (const conn of myConnections) {
      const friendId = conn.requester_id === userId ? conn.addressee_id : conn.requester_id;
      directFriendIds.add(friendId);
      const friend = await this.deps.userRepository.findById(friendId);
      if (friend) {
        directFriendNames.set(friendId, friend.display_name);
      }
    }

    if (directFriendIds.size === 0) {
      return [];
    }

    const mutualMap = new Map<string, Set<string>>();

    for (const friendId of directFriendIds) {
      const friendConnections = await this.deps.connectionRepository.listByUser(friendId, "accepted");
      for (const fc of friendConnections) {
        const candidateId = fc.requester_id === friendId ? fc.addressee_id : fc.requester_id;
        if (candidateId === userId || directFriendIds.has(candidateId)) {
          continue;
        }

        const isBlocked = await this.deps.connectionRepository.isUserBlocked(userId, candidateId);
        if (isBlocked) {
          continue;
        }

        if (!mutualMap.has(candidateId)) {
          mutualMap.set(candidateId, new Set<string>());
        }
        mutualMap.get(candidateId)!.add(friendId);
      }
    }

    const results: FriendOfFriendSummary[] = [];

    for (const [candidateId, mutualFriendIds] of mutualMap.entries()) {
      const candidate = await this.deps.userRepository.findById(candidateId);
      if (!candidate || candidate.status !== "active") {
        continue;
      }

      const firstMutualId = [...mutualFriendIds][0];
      const mutualName = firstMutualId ? directFriendNames.get(firstMutualId) || null : null;

      results.push({
        id: candidate.id,
        display_name: candidate.display_name,
        email: candidate.email,
        mutual_friend_name: mutualName,
        mutual_friends_count: mutualFriendIds.size,
        relationship: "friend_of_friend",
        avatar_url: candidate.avatar_url ?? null,
      });
    }

    return results.sort((a, b) => b.mutual_friends_count - a.mutual_friends_count || a.display_name.localeCompare(b.display_name));
  }

  async graph(userId: string, depth = 2): Promise<NetworkGraph> {
    const normalizedDepth = normalizeDepth(depth);
    const users = await this.walk(userId, normalizedDepth);
    const nodes = await this.toNodes(userId, users);
    const visibleIds = new Set(users.map((entry) => entry.user_id));
    const edges = new Map<string, NetworkEdge>();
    for (const entry of users) {
      const connections = await this.deps.connectionRepository.listByUser(entry.user_id, "accepted");
      for (const connection of connections) {
        const otherUserId = connection.requester_id === entry.user_id
          ? connection.addressee_id
          : connection.requester_id;
        if (!visibleIds.has(otherUserId)) {
          continue;
        }
        const key = [entry.user_id, otherUserId].sort().join(":");
        edges.set(key, {
          from_user_id: entry.user_id,
          to_user_id: otherUserId,
          status: "accepted",
        });
      }
    }

    return { nodes, edges: [...edges.values()] };
  }

  private async walk(userId: string, maxDepth: number) {
    await this.assertUserExists(userId);
    const visited = new Map<string, { depth: 0 | 1 | 2; via_user_id: string | null }>([
      [userId, { depth: 0, via_user_id: null }],
    ]);
    let frontier = [userId];

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const nextFrontier: string[] = [];

      for (const currentUserId of frontier) {
        const connections = await this.deps.connectionRepository.listByUser(currentUserId, "accepted");

        for (const connection of connections) {
          const neighborId = connection.requester_id === currentUserId
            ? connection.addressee_id
            : connection.requester_id;

          if (visited.has(neighborId)) {
            continue;
          }

          visited.set(neighborId, {
            depth: depth as 1 | 2,
            via_user_id: depth === 2 ? currentUserId : null,
          });
          nextFrontier.push(neighborId);
        }
      }

      frontier = nextFrontier;
    }

    return [...visited.entries()].map(([entryUserId, metadata]) => ({ user_id: entryUserId, ...metadata }));
  }

  private async toNodes(userId: string, users: Array<{ user_id: string; depth: 0 | 1 | 2; via_user_id: string | null }>) {
    const countsByUser = new Map<string, number>();

    if (this.deps.cardRepository) {
      for (const entry of users) {
        if (entry.depth === 0) {
          countsByUser.set(entry.user_id, await this.deps.cardRepository.countByUser(entry.user_id));
        } else if (entry.depth === 1) {
          const cards = await this.deps.cardRepository.listByUser(entry.user_id, ["DIRECT_FRIENDS", "TOTAL_NETWORK"]);
          countsByUser.set(entry.user_id, cards.length);
        } else if (entry.depth === 2) {
          const cards = await this.deps.cardRepository.listByUser(entry.user_id, ["TOTAL_NETWORK"]);
          countsByUser.set(entry.user_id, cards.length);
        }
      }
    } else {
      const resources = await this.deps.resourceRepository.listAll();
      for (const resource of resources) {
        if (resource.status === "active" && resource.visibility !== "private") {
          countsByUser.set(resource.owner_id, (countsByUser.get(resource.owner_id) ?? 0) + 1);
        }
      }
    }

    const nodes: NetworkNode[] = [];
    for (const entry of users) {
      const user = await this.deps.userRepository.findById(entry.user_id);
      if (!user || user.status !== "active") {
        continue;
      }

      nodes.push({
        user_id: user.id,
        display_name: user.display_name,
        depth: entry.depth,
        relationship: entry.depth === 0 ? "self" : entry.depth === 1 ? "direct" : "second-degree",
        via_user_id: entry.via_user_id,
        card_count: countsByUser.get(user.id) ?? 0,
        avatar_url: user.avatar_url ?? null,
      });
    }

    return nodes;
  }

  private async assertUserExists(userId: string) {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
  }
}

function normalizeDepth(depth: number): 1 | 2 {
  if (depth !== 1 && depth !== 2) {
    throw new HttpError(400, "depth must be 1 or 2");
  }

  return depth;
}

export { NetworkService };
export type { NetworkEdge, NetworkGraph, NetworkNode };
