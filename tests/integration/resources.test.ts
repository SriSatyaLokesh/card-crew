// Ports: backend-b4-b10.test.ts "POST /resources and GET /resources list the owner's cards"
// and "resource reads and mutations require the owner or an allowed viewer"
import { describe, expect, it } from "vitest";
import { addResource, adminClient, becomeFriends, createTestUser, getCatalogItemId, syncProfile } from "./src/helpers.js";

describe("resources", () => {
  it("owner creates a resource and it appears in their own list", async () => {
    const owner = await createTestUser();
    await syncProfile(owner, "Owner");
    const cardId = await getCatalogItemId(owner.client, "Infinia", "hdfc");

    const created = await addResource(owner, cardId, { visibility_depth: 1 });
    expect(created.owner_id).toBe(owner.id);
    expect(created.catalog_item_id).toBe(cardId);

    const { data: list, error } = await owner.client.from("resources").select("*").eq("owner_id", owner.id);
    expect(error).toBeNull();
    expect(list!.length).toBe(1);
  });

  it("duplicate active resource for the same catalog item is rejected (partial unique index)", async () => {
    const owner = await createTestUser();
    await syncProfile(owner, "Owner");
    const cardId = await getCatalogItemId(owner.client, "Infinia", "hdfc");
    await addResource(owner, cardId);

    const { error } = await owner.client.from("resources").insert({ owner_id: owner.id, catalog_item_id: cardId });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505"); // unique_violation
  });

  it("a stranger cannot see a private (visibility_depth=0) resource at all", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    await Promise.all([syncProfile(owner, "Owner"), syncProfile(stranger, "Stranger")]);
    const cardId = await getCatalogItemId(owner.client, "Infinia", "hdfc");
    const resource = await addResource(owner, cardId, { visibility_depth: 0 });

    const { data, error } = await stranger.client.from("resources").select("*").eq("id", resource.id);
    expect(error).toBeNull();
    expect(data).toEqual([]); // RLS excludes the row entirely, not a 403

    const { data: viaRpc, error: rpcError } = await stranger.client.rpc("get_resource", { p_resource_id: resource.id });
    expect(viaRpc).toBeNull();
    expect(rpcError!.code).toBe("PT403");
  });

  it(
    "a stranger's UPDATE on someone else's resource silently affects zero rows " +
      "(RLS-filtered mutations return success/empty, not an error — see docs/DATABASE_DESIGN.md §RLS fixes)",
    async () => {
      const owner = await createTestUser();
      const stranger = await createTestUser();
      await Promise.all([syncProfile(owner, "Owner"), syncProfile(stranger, "Stranger")]);
      const cardId = await getCatalogItemId(owner.client, "Infinia", "hdfc");
      const resource = await addResource(owner, cardId, { visibility_depth: 1 });

      const { data, error } = await stranger.client
        .from("resources")
        .update({ visibility_depth: 3 })
        .eq("id", resource.id)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]); // zero rows matched the stranger's RLS-scoped view

      const { data: unchanged } = await adminClient.from("resources").select("visibility_depth").eq("id", resource.id).single();
      expect(unchanged!.visibility_depth).toBe(1); // owner's original value, untouched
    },
  );

  it("a direct friend can see a friends-visible (visibility_depth=1) resource via get_resource", async () => {
    const owner = await createTestUser();
    const friend = await createTestUser();
    await Promise.all([syncProfile(owner, "Owner"), syncProfile(friend, "Friend")]);
    await becomeFriends(owner, friend);
    const cardId = await getCatalogItemId(owner.client, "Infinia", "hdfc");
    const resource = await addResource(owner, cardId, { visibility_depth: 1 });

    const { data, error } = await friend.client.rpc("get_resource", { p_resource_id: resource.id });
    expect(error).toBeNull();
    expect(data.id).toBe(resource.id);
  });
});
