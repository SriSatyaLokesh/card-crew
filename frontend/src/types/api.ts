type UserStatus = "active" | "blocked" | "deleted";

type UserProfile = {
  id: string;
  phone: string | null;
  display_name: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

type CardCatalogSummary = {
  id: string;
  issuer: string;
  issuer_slug: string;
  product_name: string;
  card_type: string;
  card_category: "credit" | "debit" | "prepaid" | "charge";
  network: string;
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
  resource_id: string;
  depth: 1 | 2;
  via_user_id: string | null;
  requestable: boolean;
  needs_referral: boolean;
};

type NetworkNode = {
  user_id: string;
  display_name: string;
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
  ReferralStatus,
  RequestStatus,
  RequestSummary,
  ResourceStatus,
  ResourceSummary,
  ResourceVisibility,
  UserProfile,
  UserStatus,
};
