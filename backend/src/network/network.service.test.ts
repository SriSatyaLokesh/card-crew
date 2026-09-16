import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryConnectionRepository } from "../connections/connection.repository.js";
import { InMemoryResourceRepository } from "../resources/resource.repository.js";
import { InMemoryUserRepository } from "../users/user.repository.js";
import { ConnectionService } from "../connections/connection.service.js";
import { NetworkService } from "./network.service.js";

test("network graph returns self, direct friends, second-degree paths, and visible card counts", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const networkService = new NetworkService({ connectionRepository, userRepository, resourceRepository });

  await userRepository.upsertProfile({ id: "me", email: "me@graph.test", display_name: "Me", status: "active" });
  await userRepository.upsertProfile({ id: "friend", email: "friend@graph.test", display_name: "Friend", status: "active" });
  await userRepository.upsertProfile({ id: "friend-of-friend", email: "fof@graph.test", display_name: "Friend Of Friend", status: "active" });

  const first = await connectionService.sendRequest({ requester_id: "me", addressee_id: "friend" });
  await connectionService.accept({ connection_id: first.id, user_id: "friend" });
  const second = await connectionService.sendRequest({ requester_id: "friend", addressee_id: "friend-of-friend" });
  await connectionService.accept({ connection_id: second.id, user_id: "friend-of-friend" });

  await resourceRepository.create({
    owner_id: "friend",
    card_catalog_id: "hdfc-infinia",
    visibility: "friends",
    request_enabled: true,
    notes: null,
  });
  await resourceRepository.create({
    owner_id: "friend-of-friend",
    card_catalog_id: "axis-atlas",
    visibility: "network",
    request_enabled: true,
    notes: null,
  });

  const graph = await networkService.graph("me", 2);
  assert.deepEqual(graph.nodes.map((node) => [node.user_id, node.depth, node.card_count]), [
    ["me", 0, 0],
    ["friend", 1, 1],
    ["friend-of-friend", 2, 1],
  ]);
  assert.deepEqual(
    graph.edges.map((edge) => [edge.from_user_id, edge.to_user_id].sort()),
    [["friend", "me"], ["friend", "friend-of-friend"]],
  );
});
