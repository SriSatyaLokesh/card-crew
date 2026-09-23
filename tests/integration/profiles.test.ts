// Ports: users/user.routes.test.ts (sync field resolution/precedence, invalid token
// rejection, full vs public profile split). Email resolution/409-on-duplicate-email is
// gone deliberately -- profiles has no email column (see docs/DATABASE_DESIGN.md §3 and
// its 2026-09-23 revision note); email lives only in auth.users.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { anonClient, createTestUser, syncProfile, uniquePhone } from "./src/helpers.js";

describe("sync_profile", () => {
  it("uses the display_name argument when supplied", async () => {
    const user = await createTestUser();
    const row = await syncProfile(user, "Explicit Name");
    expect(row.display_name).toBe("Explicit Name");
  });

  it("falls back to auth JWT user_metadata.display_name when no argument and no existing row", async () => {
    const user = await createTestUser({ metadata: { display_name: "From Metadata" } });
    const { data, error } = await user.client.rpc("sync_profile", { p_display_name: null });
    expect(error).toBeNull();
    expect(data.display_name).toBe("From Metadata");
  });

  it("preserves the existing display_name on a later call that supplies none", async () => {
    const user = await createTestUser();
    await syncProfile(user, "First Call");
    const { data } = await user.client.rpc("sync_profile", { p_display_name: null });
    expect(data.display_name).toBe("First Call");
  });

  it("fails when no name can be resolved from any source", async () => {
    const user = await createTestUser(); // no metadata, no prior sync
    const { error } = await user.client.rpc("sync_profile", { p_display_name: null });
    expect(error!.code).toBe("PT400");
  });

  it("is idempotent and updates the row rather than erroring on conflict", async () => {
    const user = await createTestUser();
    await syncProfile(user, "First");
    const { data } = await user.client.rpc("sync_profile", { p_display_name: "Second" });
    expect(data.display_name).toBe("Second");

    const { data: rows } = await user.client.from("profiles").select("id").eq("id", user.id);
    expect(rows!.length).toBe(1); // upsert, not a duplicate row
  });
});

describe("profiles visibility", () => {
  it("self can read the full row including phone; a stranger gets nothing from the base table", async () => {
    const user = await createTestUser();
    await syncProfile(user, "Me");
    const phone = uniquePhone();
    await user.client.from("profiles").update({ phone }).eq("id", user.id);

    const { data: own } = await user.client.from("profiles").select("*").eq("id", user.id).single();
    expect(own.phone).toBe(phone);
    expect(own).not.toHaveProperty("email"); // no email column at all -- lives in auth.users

    const stranger = await createTestUser();
    await syncProfile(stranger, "Stranger");
    const { data: viaStranger } = await stranger.client.from("profiles").select("*").eq("id", user.id);
    expect(viaStranger).toEqual([]);
  });

  it("profiles_public exposes display_name/status to any authenticated user, never phone", async () => {
    const user = await createTestUser();
    await syncProfile(user, "Public Name");
    await user.client.from("profiles").update({ phone: uniquePhone() }).eq("id", user.id);

    const stranger = await createTestUser();
    await syncProfile(stranger, "Stranger");
    const { data, error } = await stranger.client.from("profiles_public").select("*").eq("id", user.id).single();
    expect(error).toBeNull();
    expect(data.display_name).toBe("Public Name");
    expect(data).not.toHaveProperty("phone");
  });

  it(
    "profiles_public is not readable by anon -- errors outright (42501), unlike RLS-filtered " +
      "tables which return an empty result: this view has no grant for anon at all, a stricter " +
      "gate than row-level filtering (see supabase/migrations/20260923000002_rls.sql)",
    async () => {
      const client = anonClient();
      const { data, error } = await client.from("profiles_public").select("id").limit(1);
      expect(data).toBeNull();
      expect(error!.code).toBe("42501");
    },
  );
});

describe("auth boundary", () => {
  it("rejects an RPC call from a signed-out (anon-key-only) client", async () => {
    const client = anonClient();
    const { error } = await client.rpc("get_dashboard");
    expect(error).not.toBeNull();
  });

  it("rejects an RPC call carrying a malformed bearer token", async () => {
    const badClient = createClient(
      process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
      process.env.SUPABASE_ANON_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: "Bearer garbage.token.here" } } },
    );
    const { error } = await badClient.rpc("get_dashboard");
    expect(error).not.toBeNull();
  });
});
