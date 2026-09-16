type ResourceVisibility = "private" | "friends" | "network";
type ResourceStatus = "active" | "inactive" | "removed";

type ResourceRecord = {
  id: string;
  owner_id: string;
  card_catalog_id: string;
  visibility: ResourceVisibility;
  request_enabled: boolean;
  notes: string | null;
  status: ResourceStatus;
  created_at: Date;
  updated_at: Date;
};

type CreateResourceInput = {
  owner_id: string;
  card_catalog_id: string;
  visibility?: ResourceVisibility;
  request_enabled?: boolean;
  notes?: string | null;
};

type UpdateResourceInput = {
  visibility?: ResourceVisibility;
  request_enabled?: boolean;
  notes?: string | null;
  status?: ResourceStatus;
};

export type { CreateResourceInput, ResourceRecord, ResourceStatus, ResourceVisibility, UpdateResourceInput };
