import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "./supabaseClient";
import type {
  BlockedUserSummary,
  CardCatalogSummary,
  ContactInfo,
  FriendOfFriendSummary,
  FriendRequestSummary,
  FriendshipSummary,
  NetworkEdge,
  NetworkMatch,
  NetworkNode,
  NetworkStats,
  PersonCard,
  ReferralStatus,
  RequestStatus,
  RequestSummary,
  ResourceStatus,
  ResourceSummary,
  ResourceVisibility,
  SearchUserSummary,
  UserCard,
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
// catch RLS silently filtering out a PATCH/DELETE the caller doesn't own: every write below
// chains `.select().single()` so that case surfaces as a real error instead of a silent no-op.
const PG_STATUS: Record<string, number> = {
  PT400: 400,
  PT401: 401,
  PT403: 403,
  PT404: 404,
  PT409: 409,
  PT429: 429,
};

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

async function syncUser(displayName?: string, avatarUrl?: string) {
  const res = await supabase.rpc("sync_profile", {
    p_display_name: displayName ?? null,
    p_avatar_url: avatarUrl ?? null,
  });
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

async function getPersonCards(userId: string) {
  const res = await supabase.rpc("get_person_cards", { p_user_id: userId });
  return { cards: unwrap(res) as PersonCard[] };
}

async function getCards(userId: string): Promise<{ cards: UserCard[] }> {
  try {
    const res = await supabase.rpc("get_person_cards", { p_user_id: userId });
    const rows = (unwrap(res) as PersonCard[]) || [];
    const cards: UserCard[] = rows.map((c) => ({
      id: c.id,
      userId: c.owner_id,
      cardName: c.product_name || (c.notes || "Payment Card"),
      cardType: c.card_type || c.card_category || "Credit Card",
      visibilityScope: (c.visibility_depth ?? 1) >= 2 ? "TOTAL_NETWORK" : "DIRECT_FRIENDS",
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
    return { cards };
  } catch {
    return { cards: [] };
  }
}

async function createCard(input: {
  cardName: string;
  cardType: string;
  visibilityScope?: "DIRECT_FRIENDS" | "TOTAL_NETWORK";
}): Promise<{ card: UserCard }> {
  const userRes = await supabase.auth.getUser();
  const ownerId = userRes.data.user?.id;
  if (!ownerId) throw new ApiError(401, "not_authenticated");

  const catRes = await supabase
    .from("catalog_cards_view")
    .select("id")
    .ilike("product_name", `%${input.cardName.trim()}%`)
    .limit(1);

  let catalogItemId = catRes.data?.[0]?.id;
  if (!catalogItemId) {
    const anyCat = await supabase.from("catalog_cards_view").select("id").limit(1);
    catalogItemId = anyCat.data?.[0]?.id;
  }

  if (!catalogItemId) {
    throw new ApiError(400, "Catalog items not found");
  }

  const depth = input.visibilityScope === "TOTAL_NETWORK" ? 2 : 1;
  const ins = await supabase
    .from("resources")
    .insert({
      owner_id: ownerId,
      catalog_item_id: catalogItemId,
      visibility_depth: depth,
      request_enabled: true,
      notes: input.cardName,
    })
    .select()
    .single();

  const row = unwrap(ins) as ResourceRow;
  return {
    card: {
      id: row.id,
      userId: row.owner_id,
      cardName: input.cardName,
      cardType: input.cardType,
      visibilityScope: input.visibilityScope ?? "DIRECT_FRIENDS",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

async function updateCard(
  cardId: string,
  patch: {
    cardName?: string;
    cardType?: string;
    visibilityScope?: "DIRECT_FRIENDS" | "TOTAL_NETWORK";
  },
): Promise<{ card: UserCard }> {
  const updates: Record<string, any> = {};
  if (patch.visibilityScope) {
    updates.visibility_depth = patch.visibilityScope === "TOTAL_NETWORK" ? 2 : 1;
  }
  if (patch.cardName) {
    updates.notes = patch.cardName;
  }

  const res = await supabase.from("resources").update(updates).eq("id", cardId).select().single();
  const row = unwrap(res) as ResourceRow;
  return {
    card: {
      id: row.id,
      userId: row.owner_id,
      cardName: patch.cardName || row.notes || "Payment Card",
      cardType: patch.cardType || "Credit Card",
      visibilityScope: (row.visibility_depth ?? 1) >= 2 ? "TOTAL_NETWORK" : "DIRECT_FRIENDS",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

async function deleteCard(cardId: string): Promise<void> {
  await deleteResource(cardId);
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

async function getFriendships(_userId?: string) {
  const res = await supabase.from("friendships").select("*");
  return { friendships: unwrap(res) as FriendshipSummary[] };
}

async function getPendingFriendRequests(_userId?: string) {
  const res = await supabase.from("friend_requests").select("*").eq("status", "pending");
  return { requests: unwrap(res) as FriendRequestSummary[] };
}

async function getBlockedUsers() {
  const res = await supabase.from("user_blocks").select("*");
  return { blocks: unwrap(res) as BlockedUserSummary[] };
}

async function sendFriendRequest(addresseeId: string) {
  const res = await supabase.rpc("send_friend_request", { p_addressee_id: addresseeId });
  const req = unwrap(res) as FriendRequestSummary;
  return { request: req, connection: req };
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

async function unblockUser(targetId: string) {
  const res = await supabase.from("user_blocks").delete().eq("blocked_id", targetId);
  if (res.error) throw toApiError(res.error);
}

async function removeFriend(friendId: string) {
  const res = await supabase.rpc("remove_friend", { p_friend_id: friendId });
  unwrap(res);
}

async function searchNetwork(catalogItemId: string, depth = 1) {
  const res = await supabase.rpc("search_network", { p_catalog_item: catalogItemId, p_max_depth: depth });
  return { matches: unwrap(res) as NetworkMatch[] };
}

async function getNetworkGraph(depth = 2, _userId?: string) {
  const res = await supabase.rpc("network_graph", { p_max_depth: depth });
  return unwrap(res) as { nodes: NetworkNode[]; edges: NetworkEdge[]; truncated: boolean };
}

async function getNetworkStats(userId?: string): Promise<NetworkStats> {
  try {
    const [friendshipsRes, requestsRes, graphRes] = await Promise.all([
      supabase.from("friendships").select("user_a, user_b"),
      supabase.from("friend_requests").select("id, requester_id, addressee_id").eq("status", "pending"),
      supabase.rpc("network_graph", { p_max_depth: 2 }),
    ]);

    const user = (await supabase.auth.getUser()).data.user;
    const currentUserId = userId || user?.id;

    const directFriends = (friendshipsRes.data || []).length;
    const incoming = (requestsRes.data || []).filter((r: any) => r.addressee_id === currentUserId).length;
    const pending = (requestsRes.data || []).filter((r: any) => r.requester_id === currentUserId).length;
    const graphNodes = (graphRes.data as any)?.nodes || [];
    const fof = graphNodes.filter((n: any) => n.depth === 2).length;

    return {
      totalRequests: incoming + pending,
      directFriends,
      friendsOfFriends: fof,
      incomingRequests: incoming,
      pendingRequests: pending,
      blockedMe: 0,
    };
  } catch {
    return {
      totalRequests: 0,
      directFriends: 0,
      friendsOfFriends: 0,
      incomingRequests: 0,
      pendingRequests: 0,
      blockedMe: 0,
    };
  }
}

async function getFriendsOfFriends(_userId?: string): Promise<{ friendsOfFriends: FriendOfFriendSummary[] }> {
  try {
    const res = await supabase.rpc("network_graph", { p_max_depth: 2 });
    const nodes = ((unwrap(res) as any)?.nodes || []) as NetworkNode[];
    const fofNodes = nodes.filter((n) => n.depth === 2);
    const fofList: FriendOfFriendSummary[] = fofNodes.map((n) => ({
      id: n.user_id,
      display_name: n.display_name,
      mutual_friend_name: null,
      mutual_friends_count: 1,
      relationship: "friend_of_friend",
      avatar_url: n.avatar_url ?? null,
    }));
    return { friendsOfFriends: fofList };
  } catch {
    return { friendsOfFriends: [] };
  }
}

async function getUserProfile(userId: string): Promise<{ user: UserProfile }> {
  const res = await supabase.from("profiles_public").select("*").eq("id", userId).single();
  const data = unwrap(res) as any;
  return {
    user: {
      id: data.id,
      display_name: data.display_name,
      avatar_url: data.avatar_url ?? null,
      status: data.status,
      phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

async function searchUsers(query: string, searchFilter?: string): Promise<{ users: SearchUserSummary[] }> {
  const normalized = query.trim();
  if (!normalized) return { users: [] };

  const user = (await supabase.auth.getUser()).data.user;
  const currentUserId = user?.id;

  const res = await supabase
    .from("profiles_public")
    .select("id, display_name, avatar_url, status")
    .ilike("display_name", `%${normalized}%`)
    .limit(25);

  const rows = (unwrap(res) as Array<{ id: string; display_name: string; avatar_url: string | null; status: string }>) || [];

  const [friendsRes, requestsRes, blocksRes, graphRes] = await Promise.all([
    supabase.from("friendships").select("user_a, user_b"),
    supabase.from("friend_requests").select("id, requester_id, addressee_id").eq("status", "pending"),
    supabase.from("user_blocks").select("blocked_id"),
    supabase.rpc("network_graph", { p_max_depth: 2 }),
  ]);

  const friendIds = new Set<string>();
  for (const f of friendsRes.data || []) {
    if (f.user_a === currentUserId) friendIds.add(f.user_b);
    if (f.user_b === currentUserId) friendIds.add(f.user_a);
  }

  const incomingMap = new Map<string, string>();
  const outgoingMap = new Map<string, string>();
  for (const r of requestsRes.data || []) {
    if (r.addressee_id === currentUserId) incomingMap.set(r.requester_id, r.id);
    if (r.requester_id === currentUserId) outgoingMap.set(r.addressee_id, r.id);
  }

  const blockedIds = new Set<string>((blocksRes.data || []).map((b: any) => b.blocked_id));

  const nodes = ((graphRes.data as any)?.nodes || []) as NetworkNode[];
  const fofMap = new Map<string, NetworkNode>();
  for (const n of nodes) {
    if (n.depth === 2) fofMap.set(n.user_id, n);
  }

  const results: SearchUserSummary[] = rows
    .filter((r) => r.id !== currentUserId)
    .map((r) => {
      let relationship: SearchUserSummary["relationship"] = "none";
      let connection_id: string | null = null;
      let mutual_friend_name: string | null = null;

      if (friendIds.has(r.id)) {
        relationship = "direct_friend";
      } else if (incomingMap.has(r.id)) {
        relationship = "incoming_request";
        connection_id = incomingMap.get(r.id) ?? null;
      } else if (outgoingMap.has(r.id)) {
        relationship = "outgoing_request";
        connection_id = outgoingMap.get(r.id) ?? null;
      } else if (blockedIds.has(r.id)) {
        relationship = "blocked";
      } else if (fofMap.has(r.id)) {
        relationship = "friend_of_friend";
        const node = fofMap.get(r.id);
        if (node?.via_user_id) {
          mutual_friend_name = "Mutual connection";
        }
      }

      return {
        id: r.id,
        display_name: r.display_name,
        avatar_url: r.avatar_url ?? null,
        status: r.status,
        relationship,
        connection_id,
        mutual_friend_name,
        mutual_friend_count: relationship === "friend_of_friend" ? 1 : 0,
      };
    });

  if (searchFilter === "friends") {
    return { users: results.filter((u) => u.relationship === "direct_friend") };
  } else if (searchFilter === "fof") {
    return { users: results.filter((u) => u.relationship === "friend_of_friend") };
  } else if (searchFilter === "requests") {
    return { users: results.filter((u) => u.relationship === "incoming_request" || u.relationship === "outgoing_request") };
  }

  return { users: results };
}

async function updateProfile(patch: {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}): Promise<{ user: UserProfile }> {
  let finalAvatarUrl = patch.avatarUrl;

  if (patch.avatarUrl && patch.avatarUrl.startsWith("data:")) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new ApiError(401, "not_authenticated");

    const res = await fetch(patch.avatarUrl);
    const blob = await res.blob();
    const ext = patch.avatarUrl.substring(patch.avatarUrl.indexOf("/") + 1, patch.avatarUrl.indexOf(";")) || "png";
    const filename = `${user.id}-${Date.now()}.${ext}`;

    const uploadRes = await supabase.storage.from("avatars").upload(filename, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: blob.type || "image/png",
    });

    if (uploadRes.error) {
      throw new ApiError(500, uploadRes.error.message);
    }

    const publicUrlData = supabase.storage.from("avatars").getPublicUrl(filename);
    finalAvatarUrl = publicUrlData.data.publicUrl;
  }

  const res = await supabase.rpc("sync_profile", {
    p_display_name: patch.displayName ?? null,
    p_avatar_url: finalAvatarUrl ?? null,
  });

  return { user: unwrap(res) as UserProfile };
}

async function changePassword(input: {
  newPassword: string;
  currentPassword?: string;
  confirmPassword?: string;
  oldPassword?: string;
}): Promise<void> {
  const res = await supabase.auth.updateUser({ password: input.newPassword });
  if (res.error) {
    throw new ApiError(400, res.error.message);
  }
}

async function createRequest(input: { resource_id: string; message?: string }) {
  const res = await supabase.rpc("create_request", { p_resource_id: input.resource_id, p_message: input.message ?? "" });
  return { request: unwrap(res) as RequestSummary };
}

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
  getPersonCards,
  getCards,
  createCard,
  updateCard,
  deleteCard,
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
  unblockUser,
  removeFriend,
  searchNetwork,
  getNetworkGraph,
  getNetworkStats,
  getFriendsOfFriends,
  getUserProfile,
  searchUsers,
  updateProfile,
  changePassword,
  createRequest,
  getRequests,
  respondToRequest,
  respondToReferral,
  revealContact,
};

export { ApiError };
