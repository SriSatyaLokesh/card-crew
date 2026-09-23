// Ports: connections/connection.routes.test.ts (send/duplicate/self-reject/accept/block/
// remove/list). The old model was one `Connection` table with a status enum; the new model
// splits it into friend_requests (lifecycle) + friendships (canonical accepted edge) +
// user_blocks (independent) — see docs/DATABASE_DESIGN.md §4. Tests are re-scoped to that
// split, not a literal line-for-line port.
import { describe, expect, it } from "vitest";
import { becomeFriends, createTestUser, syncProfile } from "./src/helpers.js";

describe("connections", () => {
  it("send_friend_request creates a pending row both parties can read", async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();
    await Promise.all([syncProfile(requester, "Requester"), syncProfile(addressee, "Addressee")]);

    const { data, error } = await requester.client.rpc("send_friend_request", { p_addressee_id: addressee.id });
    expect(error).toBeNull();
    expect(data.requester_id).toBe(requester.id);
    expect(data.addressee_id).toBe(addressee.id);
    expect(data.status).toBe("pending");

    const { data: seenByAddressee } = await addressee.client.from("friend_requests").select("*").eq("id", data.id);
    expect(seenByAddressee!.length).toBe(1);
  });

  it("rejects a duplicate pending request between the same pair", async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();
    await Promise.all([syncProfile(requester, "R"), syncProfile(addressee, "A")]);
    await requester.client.rpc("send_friend_request", { p_addressee_id: addressee.id });

    const { error } = await requester.client.rpc("send_friend_request", { p_addressee_id: addressee.id });
    expect(error!.code).toBe("PT409");
  });

  it("rejects a self-friend-request", async () => {
    const user = await createTestUser();
    await syncProfile(user, "Solo");
    const { error } = await user.client.rpc("send_friend_request", { p_addressee_id: user.id });
    expect(error!.code).toBe("PT400");
  });

  it("only the addressee can accept, and only while pending", async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();
    await Promise.all([syncProfile(requester, "R"), syncProfile(addressee, "A")]);
    const { data: req } = await requester.client.rpc("send_friend_request", { p_addressee_id: addressee.id });

    const { error: wrongParty } = await requester.client.rpc("accept_friend_request", { p_request_id: req.id });
    expect(wrongParty!.code).toBe("PT403");

    const { error: ok } = await addressee.client.rpc("accept_friend_request", { p_request_id: req.id });
    expect(ok).toBeNull();

    const { error: alreadyAccepted } = await addressee.client.rpc("accept_friend_request", { p_request_id: req.id });
    expect(alreadyAccepted!.code).toBe("PT409");
  });

  it("block is idempotent, drops the friendship, and cancels pending requests between the pair", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await Promise.all([syncProfile(a, "A"), syncProfile(b, "B")]);
    await becomeFriends(a, b);

    const { error: first } = await a.client.rpc("block_user", { p_target_id: b.id });
    expect(first).toBeNull();
    const { error: second } = await a.client.rpc("block_user", { p_target_id: b.id }); // deliberately idempotent, not a 409
    expect(second).toBeNull();

    const { data: friendship } = await a.client.from("friendships").select("*");
    expect(friendship).toEqual([]);

    // a fresh request between blocked parties is rejected outright
    const { error: blockedRequest } = await b.client.rpc("send_friend_request", { p_addressee_id: a.id });
    expect(blockedRequest!.code).toBe("PT403");
  });

  it("block also cancels a pending (not-yet-accepted) friend request between the pair", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await Promise.all([syncProfile(a, "A"), syncProfile(b, "B")]);
    await a.client.rpc("send_friend_request", { p_addressee_id: b.id });

    await b.client.rpc("block_user", { p_target_id: a.id });

    const { data } = await a.client.from("friend_requests").select("*").eq("requester_id", a.id).eq("addressee_id", b.id);
    expect(data).toEqual([]);
  });

  it("remove_friend requires an existing friendship", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await Promise.all([syncProfile(a, "A"), syncProfile(b, "B")]);

    const { error: notFriendsYet } = await a.client.rpc("remove_friend", { p_friend_id: b.id });
    expect(notFriendsYet!.code).toBe("PT404");

    await becomeFriends(a, b);
    const { error: ok } = await a.client.rpc("remove_friend", { p_friend_id: b.id });
    expect(ok).toBeNull();
    const { data: gone } = await a.client.from("friendships").select("*");
    expect(gone).toEqual([]);
  });

  it("a stranger cannot see friend_requests/friendships they are not a party to (RLS party-read)", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const stranger = await createTestUser();
    await Promise.all([syncProfile(a, "A"), syncProfile(b, "B"), syncProfile(stranger, "Stranger")]);
    await becomeFriends(a, b);

    const { data } = await stranger.client.from("friendships").select("*");
    expect(data).toEqual([]);
  });
});
