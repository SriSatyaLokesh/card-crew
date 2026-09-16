type UserStatus = "active" | "blocked" | "deleted";

type UserProfile = {
  id: string;
  email?: string;
  phone?: string | null;
  display_name: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

type ConnectionStatus = "pending" | "accepted" | "blocked" | "removed";

type ConnectionSummary = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
};

type CardCatalogSummary = {
  id: string;
  issuer: string;
  product_name: string;
  card_type: string;
  card_category: "credit" | "debit" | "prepaid" | "charge";
  network: string;
  variant: string | null;
  country: string;
  upi_enabled: boolean;
  use_cases: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ResourceVisibility = "private" | "friends" | "network";
type ResourceStatus = "active" | "inactive" | "removed";

type ResourceSummary = {
  id: string;
  owner_id: string;
  card_catalog_id: string;
  visibility: ResourceVisibility;
  request_enabled: boolean;
  notes: string | null;
  status: ResourceStatus;
  created_at: string;
  updated_at: string;
};

type NetworkMatch = {
  user_id: string;
  resource_id: string;
  relationship: string;
  depth: 1 | 2;
  via_user_id: string | null;
  requestable: boolean;
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
  status: "accepted";
};

type RequestStatus = "pending" | "approved" | "declined" | "ignored";

type RequestSummary = {
  id: string;
  requester_id: string;
  owner_id: string;
  resource_id: string;
  intermediary_id: string | null;
  message: string;
  status: RequestStatus;
  referral_status: "not_required" | "pending" | "approved" | "declined" | "ignored";
  created_at: string;
  responded_at: string | null;
};

type ContactInfo = {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  whatsapp_url: string | null;
  whatsapp_message: string;
};

export type {
  CardCatalogSummary,
  ConnectionStatus,
  ConnectionSummary,
  ContactInfo,
  NetworkMatch,
  NetworkEdge,
  NetworkNode,
  RequestStatus,
  RequestSummary,
  ResourceStatus,
  ResourceSummary,
  ResourceVisibility,
  UserProfile,
  UserStatus,
};
