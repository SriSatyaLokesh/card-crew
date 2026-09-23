// Ports: backend-b4-b10.test.ts "GET /search/network..." and "network search hides
// private and blocked resources"; network/network.service.test.ts (graph self/direct/
// second-degree + card counts).
import { describe, expect, it } from "vitest";
import { addResource, becomeFriends, createTestUser, getCatalogItemId, syncProfile } from "./src/helpers.js";

describe("search_network", () => {
  it("returns a direct friend's matching resource as requestable", async () => {
    const me = await createTestUser();
    const friend = await createTestUser();
    await Promise.all([syncProfile(me, "Me"), syncProfile(friend, "Friend")]);
    await becomeFriends(me, friend);
    const cardId = await getCatalogItemId(me.client, "Infinia", "hdfc");
    const resource = await addResource(friend, cardId, { visibility_depth: 1 });

    const { data, error } = await me.client.rpc("search_network", { p_catalog_item: cardId, p_max_depth: 1 });
    expect(error).toBeNull();
    const match = data.find((m: any) => m.owner_id === friend.id);
    expect(match).toBeTruthy();
    expect(match.resource_id).toBe(resource.id);
    expect(match.depth).toBe(1);
    expect(match.requestable).toBe(true);
    expect(match.needs_referral).toBe(false);
  });

  it("hides a private (visibility_depth=0) resource even from a direct friend", async () => {
    const me = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(me, "Me"), syncProfile(owner, "Owner")]);
    await becomeFriends(me, owner);
    const cardId = await getCatalogItemId(me.client, "Infinia", "hdfc");
    await addResource(owner, cardId, { visibility_depth: 0 });

    const { data } = await me.client.rpc("search_network", { p_catalog_item: cardId, p_max_depth: 1 });
    expect(data).toEqual([]);
  });

  it("hides a resource owned by a blocked user", async () => {
    const me = await createTestUser();
    const blockedOwner = await createTestUser();
    await Promise.all([syncProfile(me, "Me"), syncProfile(blockedOwner, "Blocked")]);
    await becomeFriends(me, blockedOwner);
    const cardId = await getCatalogItemId(me.client, "Infinia", "hdfc");
    await addResource(blockedOwner, cardId, { visibility_depth: 1 });
    await me.client.rpc("block_user", { p_target_id: blockedOwner.id });

    const { data } = await me.client.rpc("search_network", { p_catalog_item: cardId, p_max_depth: 1 });
    expect(data).toEqual([]);
  });

  it("finds a second-degree (friend-of-friend) match only at depth 2, and only when the resource allows it", async () => {
    const me = await createTestUser();
    const mutual = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(me, "Me"), syncProfile(mutual, "Mutual"), syncProfile(owner, "Owner")]);
    await becomeFriends(me, mutual);
    await becomeFriends(mutual, owner);
    const cardId = await getCatalogItemId(me.client, "Atlas", "axis");
    const resource = await addResource(owner, cardId, { visibility_depth: 2 }); // friends-of-friends

    const { data: depth1 } = await me.client.rpc("search_network", { p_catalog_item: cardId, p_max_depth: 1 });
    expect(depth1).toEqual([]);

    const { data: depth2 } = await me.client.rpc("search_network", { p_catalog_item: cardId, p_max_depth: 2 });
    const match = depth2.find((m: any) => m.owner_id === owner.id);
    expect(match).toBeTruthy();
    expect(match.resource_id).toBe(resource.id);
    expect(match.depth).toBe(2);
    expect(match.via_user_id).toBe(mutual.id);
    expect(match.needs_referral).toBe(true);
  });
});

describe("network_graph", () => {
  it("returns self + direct + second-degree nodes with correct relationship labels and visibility-aware card counts", async () => {
    const me = await createTestUser();
    const direct = await createTestUser();
    const fof = await createTestUser();
    await Promise.all([syncProfile(me, "Me"), syncProfile(direct, "Direct"), syncProfile(fof, "FoF")]);
    await becomeFriends(me, direct);
    await becomeFriends(direct, fof);
    const cardId = await getCatalogItemId(me.client, "Infinia", "hdfc");
    await addResource(direct, cardId, { visibility_depth: 1 });

    const { data, error } = await me.client.rpc("network_graph", { p_max_depth: 2 });
    expect(error).toBeNull();

    const selfNode = data.nodes.find((n: any) => n.user_id === me.id);
    expect(selfNode.relationship).toBe("self");
    expect(selfNode.depth).toBe(0);

    const directNode = data.nodes.find((n: any) => n.user_id === direct.id);
    expect(directNode.relationship).toBe("direct");
    expect(directNode.card_count).toBe(1);

    const fofNode = data.nodes.find((n: any) => n.user_id === fof.id);
    expect(fofNode.relationship).toBe("second-degree");
    expect(fofNode.via_user_id).toBe(direct.id);

    expect(data.truncated).toBe(false);
  });
});
