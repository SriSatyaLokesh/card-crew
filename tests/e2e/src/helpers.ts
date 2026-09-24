// Admin-only fixtures for E2E setup -- creating users and pre-wiring state that the UI has
// no way to do itself (e.g. there's no "look up a user by email" screen). Everything a test
// actually asserts on goes through the real UI in the spec file, not through this file.
//
// A trimmed, Playwright-side copy of tests/integration/src/helpers.ts's admin pieces --
// not a shared package, since the two suites run on different test runners (vitest vs
// Playwright) and share only ~2 functions worth of code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const TEST_PASSWORD = "Password123!Test";

const adminClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type TestUser = {
  id: string;
  email: string;
  password: string;
  displayName: string;
};

let userCounter = 0;

/** Unique-per-run phone (profiles.phone has a real `unique` constraint) -- avoids collisions
 * across repeated local runs against a persistent DB that hasn't been `supabase db reset`. */
export function uniquePhone(): string {
  userCounter += 1;
  const digits = String(Date.now() % 10_000_000).padStart(7, "0") + String(userCounter % 1000).padStart(3, "0");
  return `+91${digits}`;
}

/** Creates a real auth.users row (email pre-confirmed) so the E2E test can sign in through
 * the real login form with a known password -- no token injection into browser storage. */
export async function createTestUser(displayName: string): Promise<TestUser> {
  userCounter += 1;
  const email = `e2e-${Date.now()}-${userCounter}-${Math.random().toString(36).slice(2, 8)}@card-crew.test`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message ?? "no user returned"}`);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) throw new Error(`sign-in failed for ${email}: ${signInError.message}`);
  const { error: syncError } = await client.rpc("sync_profile", { p_display_name: displayName });
  if (syncError) throw new Error(`sync_profile failed for ${email}: ${syncError.message}`);

  return { id: data.user.id, email, password: TEST_PASSWORD, displayName };
}

/** Sends + accepts a friend request server-side so a test that isn't specifically exercising
 * the invite/accept UI (network.spec.ts) can start from "already friends". */
export async function becomeFriends(a: TestUser, b: TestUser) {
  const clientFor = (user: TestUser) => {
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    return client.auth.signInWithPassword({ email: user.email, password: user.password }).then(() => client);
  };
  const aClient = await clientFor(a);
  const bClient = await clientFor(b);

  const { data: req, error: sendError } = await aClient.rpc("send_friend_request", { p_addressee_id: b.id });
  if (sendError) throw new Error(`send_friend_request failed: ${sendError.message}`);
  const { error: acceptError } = await bClient.rpc("accept_friend_request", { p_request_id: req.id });
  if (acceptError) throw new Error(`accept_friend_request failed: ${acceptError.message}`);
}

/** Sets a user's phone directly -- sync_profile never sets it from JWT metadata, and
 * reveal_contact/the "Open WhatsApp" link have nothing to show without one. */
export async function setPhone(user: TestUser, phone: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await client.auth.signInWithPassword({ email: user.email, password: user.password });
  const { error } = await client.from("profiles").update({ phone }).eq("id", user.id);
  if (error) throw new Error(`setPhone failed: ${error.message}`);
}

/** Adds a resource as `owner` via a direct table insert -- same RLS-only path the real
 * "My Cards" page uses, just skipping the UI so requests.spec.ts can focus on the request
 * lifecycle instead of re-proving card creation (already covered by cards.spec.ts). */
export async function addResource(
  owner: TestUser,
  productName: string,
  issuerSlug: string,
  overrides: Partial<{ visibility_depth: number; request_enabled: boolean }> = {},
) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await client.auth.signInWithPassword({ email: owner.email, password: owner.password });

  const { data: card, error: cardError } = await client
    .from("catalog_cards_view")
    .select("id")
    .eq("product_name", productName)
    .eq("issuer_slug", issuerSlug)
    .single();
  if (cardError || !card) throw new Error(`catalog card not found: ${issuerSlug}/${productName}`);

  const { data, error } = await client
    .from("resources")
    .insert({ owner_id: owner.id, catalog_item_id: card.id, visibility_depth: 1, request_enabled: true, ...overrides })
    .select()
    .single();
  if (error) throw new Error(`insert resource failed: ${error.message}`);
  return data;
}
