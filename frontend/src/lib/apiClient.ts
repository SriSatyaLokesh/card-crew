import type {
  CardCatalogSummary,
  ConnectionStatus,
  ConnectionSummary,
  ContactInfo,
  NetworkMatch,
  NetworkNode,
  NetworkEdge,
  RequestStatus,
  RequestSummary,
  ResourceSummary,
  ResourceVisibility,
  UserProfile,
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? "Request failed");
  }

  return body as T;
}

function syncUser(accessToken: string, displayName?: string) {
  return request<{ user: UserProfile }>("/users/sync", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(displayName ? { display_name: displayName } : {}),
  });
}

function getUserProfile(id: string) {
  return request<{ user: UserProfile }>(`/users/${id}`);
}

function getCatalogCards() {
  return request<{ cards: CardCatalogSummary[] }>("/catalog/cards");
}

function getResources(userId: string) {
  return request<{ resources: ResourceSummary[] }>(`/resources?user_id=${encodeURIComponent(userId)}`);
}

function createResource(input: {
  owner_id: string;
  card_catalog_id: string;
  visibility?: ResourceVisibility;
  request_enabled?: boolean;
  notes?: string | null;
}) {
  return request<{ resource: ResourceSummary }>("/resources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

function updateResource(
  id: string,
  userId: string,
  patch: Partial<{ visibility: ResourceVisibility; request_enabled: boolean; notes: string | null }>,
) {
  return request<{ resource: ResourceSummary }>(`/resources/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, ...patch }),
  });
}

function deleteResource(id: string, userId: string) {
  return request<void>(`/resources/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ user_id: userId }),
  });
}

function getResource(id: string, viewerId: string) {
  return request<{ resource: ResourceSummary }>(`/resources/${id}?user_id=${encodeURIComponent(viewerId)}`);
}

function getConnections(userId: string, status?: ConnectionStatus) {
  const query = status ? `&status=${status}` : "";
  return request<{ connections: ConnectionSummary[] }>(
    `/connections?user_id=${encodeURIComponent(userId)}${query}`,
  );
}

function sendConnectionRequest(requesterId: string, addresseeId: string) {
  return request<{ connection: ConnectionSummary }>("/connections", {
    method: "POST",
    body: JSON.stringify({ requester_id: requesterId, addressee_id: addresseeId }),
  });
}

function acceptConnection(id: string, userId: string) {
  return request<{ connection: ConnectionSummary }>(
    `/connections/${id}/accept?user_id=${encodeURIComponent(userId)}`,
    { method: "POST" },
  );
}

function blockConnection(id: string, userId: string) {
  return request<{ connection: ConnectionSummary }>(
    `/connections/${id}/block?user_id=${encodeURIComponent(userId)}`,
    { method: "POST" },
  );
}

function removeConnection(id: string, userId: string) {
  return request<void>(`/connections/${id}?user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

function searchNetwork(userId: string, cardCatalogId: string, depth = 1) {
  return request<{ matches: NetworkMatch[] }>(
    `/search/network?user_id=${encodeURIComponent(userId)}&card_catalog_id=${encodeURIComponent(cardCatalogId)}&depth=${depth}`,
  );
}

function getNetworkGraph(userId: string, depth = 2) {
  return request<{ nodes: NetworkNode[]; edges: NetworkEdge[] }>(
    `/network/graph?user_id=${encodeURIComponent(userId)}&depth=${depth}`,
  );
}

function createRequest(input: {
  requester_id: string;
  owner_id: string;
  resource_id: string;
  message?: string;
}) {
  return request<{ request: RequestSummary }>("/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

function getIncomingRequests(ownerId: string) {
  return request<{ requests: RequestSummary[] }>(`/requests/incoming?user_id=${encodeURIComponent(ownerId)}`);
}

function getOutgoingRequests(requesterId: string) {
  return request<{ requests: RequestSummary[] }>(`/requests/outgoing?user_id=${encodeURIComponent(requesterId)}`);
}

function getReferralRequests(intermediaryId: string) {
  return request<{ requests: RequestSummary[] }>(`/requests/referrals?user_id=${encodeURIComponent(intermediaryId)}`);
}

function updateReferralStatus(id: string, userId: string, referral_status: "approved" | "declined" | "ignored") {
  return request<{ request: RequestSummary }>(`/requests/${id}/referral`, {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, referral_status }),
  });
}

function updateRequestStatus(id: string, userId: string, status: RequestStatus) {
  return request<{ request: RequestSummary }>(`/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, status }),
  });
}

function revealContact(id: string, userId: string, message?: string) {
  return request<{ contact: ContactInfo }>(`/requests/${id}/contact`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...(message?.trim() ? { message: message.trim() } : {}) }),
  });
}

export const api = {
  syncUser,
  getUserProfile,
  getCatalogCards,
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getConnections,
  sendConnectionRequest,
  acceptConnection,
  blockConnection,
  removeConnection,
  searchNetwork,
  getNetworkGraph,
  createRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getReferralRequests,
  updateRequestStatus,
  updateReferralStatus,
  revealContact,
};

export { ApiError };
