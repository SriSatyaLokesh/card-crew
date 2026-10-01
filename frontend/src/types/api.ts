type UserStatus = "active" | "blocked" | "deleted";

type UserProfile = {
  id: string;
  email?: string;
  username?: string | null;
  phone: string | null;
  display_name: string;
  avatar_url?: string | null;
  status: UserStatus;
  has_password?: boolean;
  created_at: string;
  updated_at: string;
};

export type UserCard = {
  id: string;
  userId: string;
  cardName: string;
  cardType: string;
  visibilityScope?: "DIRECT_FRIENDS" | "TOTAL_NETWORK";
  createdAt: string;
  updatedAt: string;
};

export type SearchUserSummary = {
  id: string;
  display_name: string;
  email?: string;
  status: string;
  relationship: "direct_friend" | "friend_of_friend" | "incoming_request" | "outgoing_request" | "blocked" | "none" | "self";
  mutual_friend_name?: string | null;
  mutual_friend_count?: number;
  connection_id?: string | null;
  avatar_url?: string | null;
};

export type NetworkStats = {
  totalRequests: number;
  directFriends: number;
  friendsOfFriends: number;
  incomingRequests: number;
  pendingRequests: number;
  blockedMe: number;
};

export type FriendOfFriendSummary = {
  id: string;
  display_name: string;
  email?: string;
  mutual_friend_name: string | null;
  mutual_friends_count: number;
  relationship: "friend_of_friend";
  avatar_url?: string | null;
};

type CardCatalogSummary = {
  id: string;
  issuer: string;
  issuer_slug: string;
  product_name: string;
  card_type: string;
  card_category: "credit" | "debit" | "prepaid" | "charge";
  network: string;
  segment: "retail" | "co-branded" | "corporate";
  variant: string | null;
  country: string;
  upi_enabled: boolean;
  use_cases: string[];
  active: boolean;
};

type ResourceVisibility = "private" | "friends" | "network";
type ResourceStatus = "active" | "inactive" | "removed";

type ResourceSummary = {
  id: string;
  owner_id: string;
  catalog_item_id: string;
  visibility: ResourceVisibility;
  request_enabled: boolean;
  notes: string | null;
  status: ResourceStatus;
  created_at: string;
  updated_at: string;
};

type PersonCard = {
  id: string;
  owner_id: string;
  catalog_item_id: string;
  visibility_depth: number;
  request_enabled: boolean;
  status: ResourceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product_name: string;
  issuer: string;
  issuer_slug: string;
  card_type: string;
  card_category: "credit" | "debit" | "prepaid" | "charge";
  variant: string | null;
  upi_enabled: boolean;
  network: string;
  segment: "retail" | "co-branded" | "corporate";
  use_cases: string[];
};

type FriendshipSummary = {
  user_a: string;
  user_b: string;
  created_at: string;
};

type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

type FriendRequestSummary = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
};

type BlockedUserSummary = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

type NetworkMatch = {
  owner_id: string;
  display_name: string;
  avatar_url?: string | null;
  resource_id: string;
  depth: 1 | 2;
  via_user_id: string | null;
  requestable: boolean;
  needs_referral: boolean;
};

type NetworkNode = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  depth: 0 | 1 | 2;
  relationship: "self" | "direct" | "second-degree";
  via_user_id: string | null;
  card_count: number;
};

type NetworkEdge = {
  from_user_id: string;
  to_user_id: string;
};

type RequestStatus = "pending" | "approved" | "declined" | "ignored";
type ReferralStatus = "not_required" | "pending" | "approved" | "declined" | "ignored";

type RequestSummary = {
  id: string;
  requester_id: string;
  owner_id: string;
  resource_id: string;
  intermediary_id: string | null;
  message: string;
  status: RequestStatus;
  referral_status: ReferralStatus;
  created_at: string;
  responded_at: string | null;
};

type ContactInfo = {
  id: string;
  display_name: string;
  phone: string | null;
  whatsapp_message: string;
};

export type {
  BlockedUserSummary,
  CardCatalogSummary,
  ContactInfo,
  FriendRequestStatus,
  FriendRequestSummary,
  FriendshipSummary,
  NetworkEdge,
  NetworkMatch,
  NetworkNode,
  PersonCard,
  ReferralStatus,
  RequestStatus,
  RequestSummary,
  ResourceStatus,
  ResourceSummary,
  ResourceVisibility,
  UserProfile,
  UserStatus,
};
