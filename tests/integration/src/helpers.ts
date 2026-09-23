// Shared test fixtures for the integration suite. Every test creates its own
// random-email users via the GoTrue admin API and signs in for real (same auth flow
// production uses, no mocking) — see docs/DATABASE_MIGRATION_PLAN.md / issue #3 §8. This
// means tests don't share mutable state and can run in any order or in parallel.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// Well-known local-dev keys (supabase start prints the same values every time) — not
// secrets. Override via env for a non-local target (e.g. a CI-hosted staging project).
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TEST_PASSWORD = "Password123!Test";

/** Service-role client — bypasses RLS. Only for creating fixtures and asserting on
 * internal state (e.g. friend_edges, request_events) that a client can't read directly. */
export const adminClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** A signed-out client, exactly what an unauthenticated visitor's browser would send —
 * used only by the negative auth tests. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

let userCounter = 0;

/** A unique-per-run phone number for tests exercising `profiles.phone` (which has a real
 * `unique` constraint) — hardcoded literals collide across repeated local runs against a
 * persistent DB that hasn't been `supabase db reset` between them. */
export function uniquePhone(): string {
  userCounter += 1;
  const digits = String(Date.now() % 10_000_000).padStart(7, "0") + String(userCounter % 1000).padStart(3, "0");
  return `+91${digits}`; // always exactly 10 digits after +91
}

/** Creates a real auth.users row via the admin API, signs in as that user (real JWT, real
 * session), and returns a per-user client. `metadata` seeds auth user_metadata so
 * sync_profile's fallback-to-JWT-metadata path is testable. */
export async function createTestUser(options: { displayName?: string; metadata?: Record<string, unknown> } = {}): Promise<TestUser> {
  userCounter += 1;
  const email = `test-${Date.now()}-${userCounter}-${Math.random().toString(36).slice(2, 8)}@card-crew.test`;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: options.metadata ?? (options.displayName ? { display_name: options.displayName } : undefined),
  });
  if (createError || !created.user) {
    throw new Error(`createTestUser failed: ${createError?.message ?? "no user returned"}`);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) {
    throw new Error(`sign-in failed for ${email}: ${signInError.message}`);
  }

  return { id: created.user.id, email, client };
}

/** Calls sync_profile — every test that needs a `profiles` row does this first, mirroring
 * the real app's post-signup flow. */
export async function syncProfile(user: TestUser, displayName?: string) {
  const { data, error } = await user.client.rpc("sync_profile", { p_display_name: displayName ?? null });
  if (error) throw pgError("sync_profile", error);
  return data;
}

/** Sends + accepts a friend request so `a` and `b` become direct friends (populates
 * friendships + friend_edges via the trigger). */
export async function becomeFriends(a: TestUser, b: TestUser) {
  const { data: req, error: sendError } = await a.client.rpc("send_friend_request", { p_addressee_id: b.id });
  if (sendError) throw pgError("send_friend_request", sendError);
  const { data: accepted, error: acceptError } = await b.client.rpc("accept_friend_request", { p_request_id: req.id });
  if (acceptError) throw pgError("accept_friend_request", acceptError);
  return accepted;
}

/** Looks up a real seeded catalog card by product name + issuer slug (see
 * supabase/seed.sql) via the catalog_cards_view every client can read. */
export async function getCatalogItemId(client: SupabaseClient, productName: string, issuerSlug: string): Promise<string> {
  const { data, error } = await client
    .from("catalog_cards_view")
    .select("id")
    .eq("product_name", productName)
    .eq("issuer_slug", issuerSlug)
    .single();
  if (error || !data) {
    throw new Error(`catalog card not found: ${issuerSlug}/${productName} (${error?.message ?? "no row"})`);
  }
  return data.id as string;
}

/** Inserts a resource row as `owner` via a direct PostgREST table call (the RLS-only path
 * — no RPC needed for plain resource creation, see docs/DATABASE_DESIGN.md §7). */
export async function addResource(
  owner: TestUser,
  catalogItemId: string,
  overrides: Partial<{ visibility_depth: number; request_enabled: boolean; status: string }> = {},
) {
  const { data, error } = await owner.client
    .from("resources")
    .insert({ owner_id: owner.id, catalog_item_id: catalogItemId, ...overrides })
    .select()
    .single();
  if (error) throw pgError("insert resources", error);
  return data;
}

/** Wraps a PostgrestError/FunctionsError with the operation name in the message, so a
 * failed assertion in a test points straight at which call failed instead of a bare
 * Postgres error string. */
function pgError(op: string, error: { message: string; code?: string }): Error {
  return Object.assign(new Error(`${op} failed: ${error.message}${error.code ? ` (${error.code})` : ""}`), {
    code: error.code,
  });
}
