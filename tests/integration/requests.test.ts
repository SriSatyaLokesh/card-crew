// Ports: backend-b4-b10.test.ts "POST /requests and PATCH /requests/:id support owner
// approval flow", "approved requests gate contact handoff for both participants",
// "second-degree requests require intermediary referral approval before owner approval",
// "request creation rejects non-friends and blocked connections".
import { describe, expect, it } from "vitest";
import { addResource, becomeFriends, createTestUser, getCatalogItemId, syncProfile, uniquePhone } from "./src/helpers.js";

describe("requests — direct-friend flow", () => {
  it("create -> owner approves -> contact reveal works only after approval", async () => {
    const requester = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(requester, "Requester"), syncProfile(owner, "Owner")]);
    // sync_profile doesn't set phone from JWT metadata -- set it directly as the owner,
    // the only role allowed to write it (profiles_self_update RLS policy).
    const ownerPhone = uniquePhone();
    await owner.client.from("profiles").update({ phone: ownerPhone }).eq("id", owner.id);
    await becomeFriends(requester, owner);
    const cardId = await getCatalogItemId(requester.client, "Infinia", "hdfc");
    const resource = await addResource(owner, cardId, { visibility_depth: 1 });

    const { data: created, error: createError } = await requester.client.rpc("create_request", {
      p_resource_id: resource.id,
      p_message: "Can I borrow this?",
    });
    expect(createError).toBeNull();
    expect(created.status).toBe("pending");
    expect(created.intermediary_id).toBeNull();

    const { error: earlyContact } = await requester.client.rpc("reveal_contact", { p_request_id: created.id });
    expect(earlyContact!.code).toBe("PT409"); // request_not_approved

    const { data: approved, error: approveError } = await owner.client.rpc("respond_to_request", {
      p_request_id: created.id,
      p_status: "approved",
    });
    expect(approveError).toBeNull();
    expect(approved.status).toBe("approved");

    const { data: contact, error: contactError } = await requester.client.rpc("reveal_contact", { p_request_id: created.id });
    expect(contactError).toBeNull();
    expect(contact.id).toBe(owner.id);
    expect(contact.phone).toBe(ownerPhone);
    expect(contact.whatsapp_message).toContain("Card Crew");
  });

  it("only the resource owner can respond to a request", async () => {
    const requester = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(requester, "Requester"), syncProfile(owner, "Owner")]);
    await becomeFriends(requester, owner);
    const cardId = await getCatalogItemId(requester.client, "Infinia", "hdfc");
    const resource = await addResource(owner, cardId, { visibility_depth: 1 });
    const { data: created } = await requester.client.rpc("create_request", { p_resource_id: resource.id });

    const { error } = await requester.client.rpc("respond_to_request", { p_request_id: created.id, p_status: "approved" });
    expect(error!.code).toBe("PT403");
  });

  it("rejects a request from a non-friend, and from a blocked user", async () => {
    const requester = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(requester, "Requester"), syncProfile(owner, "Owner")]);
    const cardId = await getCatalogItemId(requester.client, "Infinia", "hdfc");
    const resource = await addResource(owner, cardId, { visibility_depth: 1 });

    const { error: notFriends } = await requester.client.rpc("create_request", { p_resource_id: resource.id });
    expect(notFriends!.code).toBe("PT403");

    await owner.client.rpc("block_user", { p_target_id: requester.id });
    const { error: blocked } = await requester.client.rpc("create_request", { p_resource_id: resource.id });
    expect(blocked!.code).toBe("PT403");
  });

  it("rejects a request for a resource with request_enabled=false", async () => {
    const requester = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(requester, "Requester"), syncProfile(owner, "Owner")]);
    await becomeFriends(requester, owner);
    const cardId = await getCatalogItemId(requester.client, "Infinia", "hdfc");
    const resource = await addResource(owner, cardId, { visibility_depth: 1, request_enabled: false });

    const { error } = await requester.client.rpc("create_request", { p_resource_id: resource.id });
    expect(error!.code).toBe("PT403");
  });
});

describe("requests — second-degree referral flow", () => {
  it(
    "requires the mutual friend to approve the referral before the owner can respond, " +
      "and reveal_contact carries the custom message through",
    async () => {
      const requester = await createTestUser();
      const mutual = await createTestUser();
      const owner = await createTestUser();
      await Promise.all([syncProfile(requester, "Requester"), syncProfile(mutual, "Mutual"), syncProfile(owner, "Owner")]);
      const ownerPhone = uniquePhone();
      await owner.client.from("profiles").update({ phone: ownerPhone }).eq("id", owner.id);
      await becomeFriends(requester, mutual);
      await becomeFriends(mutual, owner);
      const cardId = await getCatalogItemId(requester.client, "Atlas", "axis");
      const resource = await addResource(owner, cardId, { visibility_depth: 2 });

      const { data: created, error: createError } = await requester.client.rpc("create_request", {
        p_resource_id: resource.id,
        p_message: "Please help",
      });
      expect(createError).toBeNull();
      expect(created.intermediary_id).toBe(mutual.id);
      expect(created.referral_status).toBe("pending");

      const { error: tooSoon } = await owner.client.rpc("respond_to_request", { p_request_id: created.id, p_status: "approved" });
      expect(tooSoon!.code).toBe("PT409"); // referral_must_be_approved_first

      const { error: notIntermediary } = await requester.client.rpc("respond_to_referral", {
        p_request_id: created.id,
        p_referral_status: "approved",
      });
      expect(notIntermediary!.code).toBe("PT403");

      const { error: referralOk } = await mutual.client.rpc("respond_to_referral", {
        p_request_id: created.id,
        p_referral_status: "approved",
      });
      expect(referralOk).toBeNull();

      const { error: approveOk } = await owner.client.rpc("respond_to_request", { p_request_id: created.id, p_status: "approved" });
      expect(approveOk).toBeNull();

      const { data: contact, error: contactError } = await requester.client.rpc("reveal_contact", {
        p_request_id: created.id,
        p_message: "Hi, can we coordinate this card request?",
      });
      expect(contactError).toBeNull();
      expect(contact.phone).toBe(ownerPhone);
      expect(contact.whatsapp_message).toBe("Hi, can we coordinate this card request?");
    },
  );

  it("rejects a second-degree request when the resource isn't network-visible (visibility_depth < 2)", async () => {
    const requester = await createTestUser();
    const mutual = await createTestUser();
    const owner = await createTestUser();
    await Promise.all([syncProfile(requester, "Requester"), syncProfile(mutual, "Mutual"), syncProfile(owner, "Owner")]);
    await becomeFriends(requester, mutual);
    await becomeFriends(mutual, owner);
    const cardId = await getCatalogItemId(requester.client, "Atlas", "axis");
    const resource = await addResource(owner, cardId, { visibility_depth: 1 }); // direct-friends-only

    const { error } = await requester.client.rpc("create_request", { p_resource_id: resource.id });
    expect(error!.code).toBe("PT403"); // not_available_beyond_direct_friends
  });
});
