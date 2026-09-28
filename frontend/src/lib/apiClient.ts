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
  ReferralStatus,
  RequestStatus,
  RequestSummary,
  ResourceSummary,
  ResourceVisibility,
  SearchUserSummary,
  UserCard,
  UserProfile,
} from "../types/api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN_KEY = "cardcrew_token";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  let response: Response;

  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    throw new ApiError(0, "Unable to reach the server. Please ensure the backend is running.");
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson.error === "string") {
        errorMessage = errorJson.error;
      }
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// Authentication
async function signup(email: string, password: string, displayName: string): Promise<{ token: string; user: UserProfile }> {
  const result = await request<{ token: string; user: UserProfile }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
  setStoredToken(result.token);
  return result;
}

async function login(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  const result = await request<{ token: string; user: UserProfile }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStoredToken(result.token);
  return result;
}

async function getMe(): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>("/auth/me");
}

async function syncUser(displayName?: string): Promise<{ user: UserProfile }> {
  const token = getStoredToken();
  if (token) {
    try {
      return await getMe();
    } catch {
      // fallback to sync
    }
  }
  return request<{ user: UserProfile }>("/users/sync", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName }),
  });
}

// User Search & Network
async function searchUsers(query: string, filter?: string): Promise<{ users: SearchUserSummary[] }> {
  const trimmed = query.trim();
  const filterParam = filter && filter !== "all" ? `&filter=${encodeURIComponent(filter)}` : "";
  return request<{ users: SearchUserSummary[] }>(`/users/search?q=${encodeURIComponent(trimmed)}${filterParam}`);
}

// Connections & Friends
type ConnectionRecordResponse = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked" | "removed";
  created_at: string;
  updated_at: string;
};

function getProfileUserId(): string | undefined {
  try {
    const raw = localStorage.getItem("cardcrew_local_profile");
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.id) return p.id;
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function getFriendships(userId?: string): Promise<{ friendships: FriendshipSummary[] }> {
  const effectiveUserId = userId || getProfileUserId();
  const query = effectiveUserId ? `?status=accepted&user_id=${effectiveUserId}` : "?status=accepted";
  const data = await request<{ connections: ConnectionRecordResponse[] }>(`/connections${query}`);

  const friendships: FriendshipSummary[] = (data.connections || []).map((c) => ({
    user_a: c.requester_id,
    user_b: c.addressee_id,
    created_at: c.created_at,
  }));

  return { friendships };
}

async function getPendingFriendRequests(userId?: string): Promise<{ requests: FriendRequestSummary[] }> {
  const effectiveUserId = userId || getProfileUserId();
  const query = effectiveUserId ? `?status=pending&user_id=${effectiveUserId}` : "?status=pending";
  const data = await request<{ connections: ConnectionRecordResponse[] }>(`/connections${query}`);

  const requests: FriendRequestSummary[] = (data.connections || []).map((c) => ({
    id: c.id,
    requester_id: c.requester_id,
    addressee_id: c.addressee_id,
    status: "pending",
    created_at: c.created_at,
    responded_at: null,
  }));

  return { requests };
}

async function getBlockedUsers(): Promise<{ blocks: (BlockedUserSummary & { user?: { id: string; display_name: string; email: string } })[] }> {
  const data = await request<{
    blocks: Array<{
      id: string;
      blocker_id: string;
      blocked_id: string;
      user?: { id: string; display_name: string; email: string };
      created_at: string;
    }>;
  }>("/connections/blocked");

  return { blocks: data.blocks || [] };
}

async function sendFriendRequest(addresseeId: string): Promise<{ connection: ConnectionRecordResponse }> {
  return request<{ connection: ConnectionRecordResponse }>("/connections", {
    method: "POST",
    body: JSON.stringify({ addressee_id: addresseeId }),
  });
}

async function acceptFriendRequest(connectionId: string): Promise<{ connection: ConnectionRecordResponse }> {
  return request<{ connection: ConnectionRecordResponse }>(`/connections/${connectionId}/accept`, {
    method: "POST",
  });
}

async function declineFriendRequest(connectionId: string): Promise<void> {
  await request(`/connections/${connectionId}`, {
    method: "DELETE",
  });
}

async function blockUser(targetUserId: string): Promise<void> {
  await request(`/connections/${targetUserId}/block`, {
    method: "POST",
  });
}

async function unblockUser(targetUserId: string): Promise<void> {
  await request(`/connections/${targetUserId}/unblock`, {
    method: "POST",
  });
}

async function removeFriend(counterpartyUserId: string): Promise<void> {
  // Try to find the connection between users and delete it
  try {
    const { connections } = await request<{ connections: ConnectionRecordResponse[] }>("/connections?status=accepted");
    const found = connections.find(
      (c) => c.requester_id === counterpartyUserId || c.addressee_id === counterpartyUserId,
    );
    if (found) {
      await request(`/connections/${found.id}`, { method: "DELETE" });
      return;
    }
  } catch {
    // fallback
  }

  await request(`/connections/${counterpartyUserId}`, { method: "DELETE" });
}

// Network Graph
async function getNetworkGraph(depth = 2, userId?: string): Promise<{ nodes: NetworkNode[]; edges: NetworkEdge[]; truncated?: boolean }> {
  const effectiveUserId = userId || getProfileUserId();
  const query = effectiveUserId ? `?depth=${depth}&user_id=${effectiveUserId}` : `?depth=${depth}`;
  try {
    const data = await request<{ nodes: NetworkNode[]; edges: NetworkEdge[] }>(`/network/graph${query}`);
    return { ...data, truncated: false };
  } catch {
    return { nodes: [], edges: [], truncated: false };
  }
}

// Network Stats
async function getNetworkStats(userId?: string): Promise<NetworkStats> {
  const effectiveUserId = userId || getProfileUserId();
  const query = effectiveUserId ? `?user_id=${effectiveUserId}` : "";
  return request<NetworkStats>(`/network/stats${query}`);
}

// Friends of Friends List
async function getFriendsOfFriends(userId?: string): Promise<{ friendsOfFriends: FriendOfFriendSummary[] }> {
  const effectiveUserId = userId || getProfileUserId();
  const query = effectiveUserId ? `?user_id=${effectiveUserId}` : "";
  return request<{ friendsOfFriends: FriendOfFriendSummary[] }>(`/network/friends-of-friends${query}`);
}

// Catalog Cards
async function getCatalogCards(): Promise<{ cards: CardCatalogSummary[] }> {
  return request<{ cards: CardCatalogSummary[] }>("/catalog/cards");
}

// Resources (Cards in Wallet)
async function getResources(): Promise<{ resources: ResourceSummary[] }> {
  return request<{ resources: ResourceSummary[] }>("/resources");
}

async function getResource(id: string): Promise<{ resource: ResourceSummary }> {
  return request<{ resource: ResourceSummary }>(`/resources/${id}`);
}

async function createResource(input: {
  owner_id: string;
  catalog_item_id: string;
  visibility?: ResourceVisibility;
  request_enabled?: boolean;
  notes?: string | null;
}): Promise<{ resource: ResourceSummary }> {
  return request<{ resource: ResourceSummary }>("/resources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function updateResource(
  id: string,
  patch: Partial<{ visibility: ResourceVisibility; request_enabled: boolean; notes: string | null }>,
): Promise<{ resource: ResourceSummary }> {
  return request<{ resource: ResourceSummary }>(`/resources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

async function deleteResource(id: string): Promise<void> {
  await request(`/resources/${id}`, { method: "DELETE" });
}

// User Saved Cards (Simplified Card Management)
async function getCards(userId?: string): Promise<{ cards: UserCard[] }> {
  const currentUserId = getProfileUserId();
  const effectiveUserId = userId || currentUserId;
  const params = new URLSearchParams();
  if (effectiveUserId) {
    params.set("user_id", effectiveUserId);
  }
  if (currentUserId) {
    params.set("viewer_id", currentUserId);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<{ cards: UserCard[] }>(`/cards${query}`);
}

async function getUserProfile(userId: string): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>(`/users/${encodeURIComponent(userId)}`);
}

async function createCard(input: {
  cardName: string;
  cardType: string;
  visibilityScope?: "DIRECT_FRIENDS" | "TOTAL_NETWORK";
}): Promise<{ card: UserCard }> {
  return request<{ card: UserCard }>("/cards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function updateCard(
  id: string,
  input: {
    cardName?: string;
    cardType?: string;
    visibilityScope?: "DIRECT_FRIENDS" | "TOTAL_NETWORK";
  },
): Promise<{ card: UserCard }> {
  return request<{ card: UserCard }>(`/cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function deleteCard(id: string): Promise<void> {
  await request(`/cards/${id}`, { method: "DELETE" });
}

// User Profile Management
async function updateProfile(input: {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Network Card Search
async function searchNetwork(catalogItemId: string, depth = 1, userId?: string): Promise<{ matches: NetworkMatch[] }> {
  const query = userId
    ? `?card_catalog_id=${catalogItemId}&depth=${depth}&user_id=${userId}`
    : `?card_catalog_id=${catalogItemId}&depth=${depth}`;
  return request<{ matches: NetworkMatch[] }>(`/search/network${query}`);
}

// Requests
async function createRequest(input: { resource_id: string; message?: string }): Promise<{ request: RequestSummary }> {
  return request<{ request: RequestSummary }>("/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function getRequests(): Promise<{ requests: RequestSummary[] }> {
  return request<{ requests: RequestSummary[] }>("/requests");
}

async function respondToRequest(id: string, status: RequestStatus): Promise<{ request: RequestSummary }> {
  return request<{ request: RequestSummary }>(`/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

async function respondToReferral(id: string, referralStatus: ReferralStatus): Promise<{ request: RequestSummary }> {
  return request<{ request: RequestSummary }>(`/requests/${id}/referral`, {
    method: "PATCH",
    body: JSON.stringify({ referral_status: referralStatus }),
  });
}

async function revealContact(id: string, message?: string): Promise<{ contact: ContactInfo }> {
  return request<{ contact: ContactInfo }>(`/requests/${id}/contact`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export const api = {
  login,
  signup,
  getMe,
  updateProfile,
  changePassword,
  syncUser,
  getUserProfile,
  searchUsers,
  getCards,
  createCard,
  updateCard,
  deleteCard,
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
  unblockUser,
  removeFriend,
  searchNetwork,
  getNetworkGraph,
  getNetworkStats,
  getFriendsOfFriends,
  createRequest,
  getRequests,
  respondToRequest,
  respondToReferral,
  revealContact,
};
