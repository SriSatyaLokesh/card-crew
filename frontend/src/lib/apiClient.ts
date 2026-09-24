import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "./supabaseClient";
import type {
  BlockedUserSummary,
  CardCatalogSummary,
  ContactInfo,
  FriendRequestSummary,
  FriendshipSummary,
  NetworkEdge,
  NetworkMatch,
  NetworkNode,
  ReferralStatus,
  RequestStatus,
  RequestSummary,
  ResourceStatus,
  ResourceSummary,
  ResourceVisibility,
  UserProfile,
} from "../types/api";

class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// RAISE EXCEPTION ... USING ERRCODE = 'PTxxx' in the RPC functions maps straight to these.
// PGRST116 is PostgREST's own "0 rows from a call that required exactly one" — used here to
// catch RLS silently filtering out a PATCH/DELETE the caller doesn't own (see issue #3 plan
// §RLS fixes note 4): every write below chains `.select().single()` so that case surfaces as
// a real error instead of a silent no-op.
const PG_STATUS: Record<string, number> = { PT400: 400, PT401: 401, PT403: 403, PT404: 404, PT409: 409, PT429: 429 };

function toApiError(error: PostgrestError): ApiError {
  if (error.code === "PGRST116") {
    return new ApiError(404, "not_found");
  }
  const status = PG_STATUS[error.code ?? ""] ?? (error.code === "23505" || error.code === "23503" ? 409 : 500);
  return new ApiError(status, error.message);
}

function unwrap<T>({ data, error }: { data: T | null; error: PostgrestError | null }): T {
  if (error) {
    throw toApiError(error);
  }
  return data as T;
}

const DEPTH_BY_VISIBILITY: Record<ResourceVisibility, number> = { private: 0, friends: 1, network: 2 };
const VISIBILITY_BY_DEPTH: Record<number, ResourceVisibility> = { 0: "private", 1: "friends", 2: "network", 3: "network" };

type ResourceRow = {
  id: string;
  owner_id: string;
  catalog_item_id: string;
  visibility_depth: number;
  request_enabled: boolean;
  notes: string | null;
  status: ResourceStatus;
  created_at: string;
  updated_at: string;
};

function toResourceSummary(row: ResourceRow): ResourceSummary {
  return { ...row, visibility: VISIBILITY_BY_DEPTH[row.visibility_depth] ?? "network" };
}

async function syncUser(displayName?: string) {
  const res = await supabase.rpc("sync_profile", { p_display_name: displayName ?? null });
  return { user: unwrap(res) as UserProfile };
}

async function getCatalogCards() {
  const res = await supabase.from("catalog_cards_view").select("*");
  return { cards: unwrap(res) as CardCatalogSummary[] };
}

async function getResources() {
  const res = await supabase.from("resources").select("*");
  return { resources: (unwrap(res) as ResourceRow[]).map(toResourceSummary) };
}

async function getResource(id: string) {
  const res = await supabase.rpc("get_resource", { p_resource_id: id });
  return { resource: toResourceSummary(unwrap(res) as ResourceRow) };
}

async function createResource(input: {
  owner_id: string;
  catalog_item_id: string;
  visibility?: ResourceVisibility;
  request_enabled?: boolean;
  notes?: string | null;
}) {
  const res = await supabase
    .from("resources")
    .insert({
      owner_id: input.owner_id,
      catalog_item_id: input.catalog_item_id,
      visibility_depth: DEPTH_BY_VISIBILITY[input.visibility ?? "friends"],
      request_enabled: input.request_enabled,
      notes: input.notes,
    })
    .select()
    .single();
  return { resource: toResourceSummary(unwrap(res) as ResourceRow) };
}

async function updateResource(
  id: string,
  patch: Partial<{ visibility: ResourceVisibility; request_enabled: boolean; notes: string | null }>,
) {
  const { visibility, ...rest } = patch;
  const res = await supabase
    .from("resources")
    .update({ ...rest, ...(visibility ? { visibility_depth: DEPTH_BY_VISIBILITY[visibility] } : {}) })
    .eq("id", id)
    .select()
    .single();
  return { resource: toResourceSummary(unwrap(res) as ResourceRow) };
}

async function deleteResource(id: string) {
  const res = await supabase.from("resources").delete().eq("id", id).select().single();
  unwrap(res);
}

async function getFriendships() {
  const res = await supabase.from("friendships").select("*");
  return { friendships: unwrap(res) as FriendshipSummary[] };
}

async function getPendingFriendRequests() {
  const res = await supabase.from("friend_requests").select("*").eq("status", "pending");
  return { requests: unwrap(res) as FriendRequestSummary[] };
}

async function getBlockedUsers() {
  const res = await supabase.from("user_blocks").select("*");
  return { blocks: unwrap(res) as BlockedUserSummary[] };
}

async function sendFriendRequest(addresseeId: string) {
  const res = await supabase.rpc("send_friend_request", { p_addressee_id: addresseeId });
  return { request: unwrap(res) as FriendRequestSummary };
}

async function acceptFriendRequest(requestId: string) {
  const res = await supabase.rpc("accept_friend_request", { p_request_id: requestId });
  return { friendship: unwrap(res) as FriendshipSummary };
}

async function declineFriendRequest(requestId: string) {
  const res = await supabase.rpc("decline_friend_request", { p_request_id: requestId });
  return { request: unwrap(res) as FriendRequestSummary };
}

async function blockUser(targetId: string) {
  const res = await supabase.rpc("block_user", { p_target_id: targetId });
  unwrap(res);
}

async function removeFriend(friendId: string) {
  const res = await supabase.rpc("remove_friend", { p_friend_id: friendId });
  unwrap(res);
}

async function searchNetwork(catalogItemId: string, depth = 1) {
  const res = await supabase.rpc("search_network", { p_catalog_item: catalogItemId, p_max_depth: depth });
  return { matches: unwrap(res) as NetworkMatch[] };
}

async function getNetworkGraph(depth = 2) {
  const res = await supabase.rpc("network_graph", { p_max_depth: depth });
  return unwrap(res) as { nodes: NetworkNode[]; edges: NetworkEdge[]; truncated: boolean };
}

async function createRequest(input: { resource_id: string; message?: string }) {
  const res = await supabase.rpc("create_request", { p_resource_id: input.resource_id, p_message: input.message ?? "" });
  return { request: unwrap(res) as RequestSummary };
}

// The three old /requests/incoming|outgoing|referrals endpoints all read the same RLS-scoped
// row set (requester_id = me OR owner_id = me OR intermediary_id = me); callers filter the
// single result client-side instead of paying for three round trips for one table.
async function getRequests() {
  const res = await supabase.from("requests").select("*");
  return { requests: unwrap(res) as RequestSummary[] };
}

async function respondToRequest(id: string, status: RequestStatus) {
  const res = await supabase.rpc("respond_to_request", { p_request_id: id, p_status: status });
  return { request: unwrap(res) as RequestSummary };
}

async function respondToReferral(id: string, referralStatus: ReferralStatus) {
  const res = await supabase.rpc("respond_to_referral", { p_request_id: id, p_referral_status: referralStatus });
  return { request: unwrap(res) as RequestSummary };
}

async function revealContact(id: string, message?: string) {
  const res = await supabase.rpc("reveal_contact", { p_request_id: id, p_message: message?.trim() || null });
  return { contact: unwrap(res) as ContactInfo };
}

export const api = {
  syncUser,
  getCatalogCards,
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getFriendships,
  getPendingFriendRequests,
  getBlockedUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  blockUser,
  removeFriend,
  searchNetwork,
  getNetworkGraph,
  createRequest,
  getRequests,
  respondToRequest,
  respondToReferral,
  revealContact,
};

export { ApiError };
