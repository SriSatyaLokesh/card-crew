type RequestStatus = "pending" | "approved" | "declined" | "ignored";
type ReferralStatus = "not_required" | "pending" | "approved" | "declined" | "ignored";

type RequestRecord = {
  id: string;
  requester_id: string;
  owner_id: string;
  resource_id: string;
  intermediary_id: string | null;
  message: string;
  status: RequestStatus;
  referral_status: ReferralStatus;
  created_at: Date;
  responded_at: Date | null;
};

type CreateRequestInput = {
  requester_id: string;
  owner_id: string;
  resource_id: string;
  intermediary_id?: string | null;
  message?: string;
};

type UpdateRequestInput = {
  user_id: string;
  status: RequestStatus;
};

type UpdateReferralInput = {
  user_id: string;
  referral_status: Exclude<ReferralStatus, "not_required">;
};

export type { CreateRequestInput, RequestRecord, RequestStatus, ReferralStatus, UpdateReferralInput, UpdateRequestInput };
