import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabaseClient";

export function ProfilePage() {
  const { profile, session, signOut, refreshProfile, updateProfileState } = useAuth();
  const navigate = useNavigate();

  // Profile fields state
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);

  // Profile update states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar upload states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password update state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sync state if profile loads later
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  // Handle Display Name Update
  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setProfileError("Display name cannot be empty.");
      return;
    }
    if (trimmedName.length > 80) {
      setProfileError("Display name must be 80 characters or fewer.");
      return;
    }

    if (!profile) {
      setProfileError("You must be logged in to update your profile.");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      // 1. Update Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: trimmedName },
      });
      if (authError) throw authError;

      // 2. Update profiles table
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          display_name: trimmedName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (dbError) throw dbError;

      updateProfileState({ ...profile, display_name: trimmedName });
      setProfileSuccess("Personal information updated successfully.");
      await refreshProfile();
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  // Handle Avatar Selection and Upload to Supabase Storage
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError(null);
    setAvatarSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!profile) {
      setAvatarError("You must be logged in to upload an avatar.");
      return;
    }

    // 1. Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setAvatarError("Please select a valid image file (JPG, PNG, WebP, or GIF).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. Validate file size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError("Selected image exceeds 5MB limit. Please choose a smaller photo.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // 3. Upload to Supabase Storage 'avatars' bucket
      const ext = file.name.split(".").pop() || "png";
      const filePath = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 4. Retrieve public URL
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // 5. Update user metadata in Supabase Auth
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      // 6. Update profiles table
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      setAvatarPreview(publicUrl);
      updateProfileState({ ...profile, avatar_url: publicUrl });
      setAvatarSuccess("Profile photo updated successfully!");
      await refreshProfile();
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload photo. Please try again.");
      setAvatarPreview(profile?.avatar_url || null);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Handle Remove Photo
  async function handleRemovePhoto() {
    if (!profile?.avatar_url) return;
    setAvatarError(null);
    setAvatarSuccess(null);
    setIsUploadingAvatar(true);

    try {
      // 1. Clear in Supabase Auth user metadata
      await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      // 2. Clear in profiles table
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      setAvatarPreview(null);
      updateProfileState({ ...profile, avatar_url: null });
      setAvatarSuccess("Profile photo removed.");
      await refreshProfile();
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Failed to remove photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  // Handle Password Update via Supabase Auth
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword) {
      setPasswordError("New password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setPasswordSuccess("Your password has been updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  // Handle Sign Out
  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login");
    } catch {
      navigate("/login");
    }
  }

  const userEmail = session?.user?.email || profile?.email || "Authenticated User";

  return (
    <div className="page" style={{ maxWidth: "780px", margin: "0 auto", paddingBottom: "80px" }}>
      {/* 1. Header Area */}
      <div className="page-hero" style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 6px 0", color: "var(--ink-950)" }}>
          Profile & Account
        </h1>
        <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--ink-600)" }}>
          Manage your personal details, profile avatar, account security, and active session.
        </p>
      </div>

      {/* 2. Profile Overview Card */}
      <section
        className="card-section"
        style={{
          background: "var(--white)",
          border: "1px solid var(--paper-200)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "1.75rem",
          marginBottom: "1.75rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          {/* Avatar & Photo Picker */}
          <div style={{ position: "relative" }}>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={profile?.display_name || "Profile"}
                style={{
                  width: "88px",
                  height: "88px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "88px",
                  height: "88px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "2rem",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
                }}
              >
                {displayName ? displayName.slice(0, 1).toUpperCase() : "?"}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: "220px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--ink-950)" }}>
                {displayName || "Unnamed User"}
              </h2>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#ecfdf5",
                  color: "#059669",
                  fontWeight: 600,
                  border: "1px solid #a7f3d0",
                }}
              >
                ● Active
              </span>
            </div>
            <p style={{ margin: "3px 0 0", color: "var(--ink-600)", fontSize: "0.88rem" }}>
              {userEmail}
            </p>

            {/* Photo Action Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handlePhotoSelected}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="button-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? "Uploading..." : "📷 Change Photo"}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  className="button-secondary btn-sm"
                  style={{ color: "#ef4444" }}
                  onClick={handleRemovePhoto}
                  disabled={isUploadingAvatar}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {avatarError && (
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "#fef2f2", color: "#dc2626", borderRadius: "6px", fontSize: "0.85rem" }}>
            ⚠️ {avatarError}
          </div>
        )}
        {avatarSuccess && (
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: "6px", fontSize: "0.85rem" }}>
            ✓ {avatarSuccess}
          </div>
        )}
      </section>

      {/* 3. Personal Information Section */}
      <section
        className="card-section"
        style={{
          background: "var(--white)",
          border: "1px solid var(--paper-200)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "1.75rem",
          marginBottom: "1.75rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <h3 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-950)" }}>
          Personal Information
        </h3>
        <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "var(--ink-600)" }}>
          Update your public display name seen across your network.
        </p>

        {profileError && (
          <div style={{ marginBottom: "1rem", padding: "8px 12px", background: "#fef2f2", color: "#dc2626", borderRadius: "6px", fontSize: "0.85rem" }}>
            ⚠️ {profileError}
          </div>
        )}
        {profileSuccess && (
          <div style={{ marginBottom: "1rem", padding: "8px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: "6px", fontSize: "0.85rem" }}>
            ✓ {profileSuccess}
          </div>
        )}

        <form onSubmit={handleProfileSubmit}>
          <div className="form-field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="display-name-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
              Full Name / Display Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="display-name-input"
              type="text"
              className="network-search-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Teja Sai"
              maxLength={80}
              required
              disabled={isUpdatingProfile}
            />
          </div>

          <div className="form-field" style={{ marginBottom: "1.25rem" }}>
            <label htmlFor="email-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
              Email Address
            </label>
            <input
              id="email-input"
              type="email"
              className="network-search-input"
              value={userEmail}
              disabled
              style={{ background: "var(--paper-100)", cursor: "not-allowed", opacity: 0.8 }}
            />
            <span style={{ fontSize: "0.76rem", color: "var(--ink-400)", marginTop: "4px", display: "block" }}>
              Your account email is tied to authentication and cannot be changed here.
            </span>
          </div>

          <button
            type="submit"
            className="button-primary-accent"
            disabled={isUpdatingProfile || !displayName.trim()}
          >
            {isUpdatingProfile ? "Saving Profile..." : "Update Profile"}
          </button>
        </form>
      </section>

      {/* 4. Security & Password Update Section */}
      <section
        className="card-section"
        style={{
          background: "var(--white)",
          border: "1px solid var(--paper-200)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "1.75rem",
          marginBottom: "1.75rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <h3 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-950)" }}>
          Security & Password
        </h3>
        <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "var(--ink-600)" }}>
          Update your account password securely using Supabase Auth.
        </p>

        {passwordError && (
          <div style={{ marginBottom: "1rem", padding: "8px 12px", background: "#fef2f2", color: "#dc2626", borderRadius: "6px", fontSize: "0.85rem" }}>
            ⚠️ {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div style={{ marginBottom: "1rem", padding: "8px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: "6px", fontSize: "0.85rem" }}>
            ✓ {passwordSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "1.25rem" }}>
            <div className="form-field">
              <label htmlFor="new-password-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
                New Password <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="new-password-input"
                type="password"
                className="network-search-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                disabled={isUpdatingPassword}
                autoComplete="new-password"
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirm-password-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
                Confirm New Password <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="confirm-password-input"
                type="password"
                className="network-search-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                disabled={isUpdatingPassword}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="button-primary-accent"
            disabled={isUpdatingPassword || !newPassword || !confirmPassword}
          >
            {isUpdatingPassword ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </section>

      {/* 5. Account & Session Management Card */}
      <section
        className="card-section"
        style={{
          background: "var(--white)",
          border: "1px solid var(--paper-200)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "1.75rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-950)" }}>
              Account Session
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-600)" }}>
              Signed in as <strong>{userEmail}</strong>. Logging out ends your active authenticated session.
            </p>
          </div>

          <button
            type="button"
            className="button-secondary"
            style={{ color: "#ef4444", borderColor: "#fca5a5" }}
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}

export default ProfilePage;
