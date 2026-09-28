type UserStatus = "active" | "blocked" | "deleted";

type UserRecord = {
  id: string;
  email: string;
  username?: string | null;
  avatar_url?: string | null;
  phone: string | null;
  display_name: string;
  status: UserStatus;
  password_hash?: string | null;
  created_at: Date;
  updated_at: Date;
};

type SyncUserInput = {
  auth_user_id: string;
  auth_email?: string | null;
  auth_user_metadata?: Record<string, unknown> | null;
  email?: string;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  display_name?: string;
};

type UpsertUserRecordInput = {
  id: string;
  email: string;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  display_name: string;
  status?: UserStatus;
};

type UserProfile = {
  id: string;
  email: string;
  username?: string | null;
  avatar_url?: string | null;
  phone: string | null;
  display_name: string;
  status: UserStatus;
  has_password?: boolean;
  created_at: string;
  updated_at: string;
};

type PublicUserProfile = {
  id: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

function toUserProfile(user: UserRecord): UserProfile {
  const profile: UserProfile = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    display_name: user.display_name,
    status: user.status,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
  if (user.username) {
    profile.username = user.username;
  }
  if (user.avatar_url) {
    profile.avatar_url = user.avatar_url;
  }
  return profile;
}

function toPublicUserProfile(user: UserRecord): PublicUserProfile {
  const profile: PublicUserProfile = {
    id: user.id,
    display_name: user.display_name,
    status: user.status,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
  if (user.username) {
    profile.username = user.username;
  }
  if (user.avatar_url) {
    profile.avatar_url = user.avatar_url;
  }
  return profile;
}

export { toUserProfile };
export { toPublicUserProfile };
export type { PublicUserProfile, SyncUserInput, UpsertUserRecordInput, UserProfile, UserRecord, UserStatus };
