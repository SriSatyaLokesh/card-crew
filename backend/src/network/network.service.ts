import { HttpError } from "../errors/http-error.js";
import type { ConnectionRepository } from "../connections/connection.repository.js";
import type { UserRepository } from "../users/user.repository.js";
import type { ResourceRepository } from "../resources/resource.repository.js";

type NetworkNode = {
  user_id: string;
  display_name: string;
  depth: 0 | 1 | 2;
  relationship: "self" | "direct" | "second-degree";
  via_user_id: string | null;
  card_count: number;
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

type NetworkServiceDependencies = {
  connectionRepository: ConnectionRepository;
  userRepository: UserRepository;
  resourceRepository: ResourceRepository;
};

class NetworkService {
  constructor(private readonly deps: NetworkServiceDependencies) {}

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
    const resources = await this.deps.resourceRepository.listAll();
    const countsByUser = new Map<string, number>();

    for (const resource of resources) {
      if (resource.status === "active" && resource.visibility !== "private") {
        countsByUser.set(resource.owner_id, (countsByUser.get(resource.owner_id) ?? 0) + 1);
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
