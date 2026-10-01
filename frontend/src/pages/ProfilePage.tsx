import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";

export function ProfilePage() {
  const { profile, signOut, updateProfileState, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Profile fields state
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sync state if profile loads later
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  // Handle Profile Update (Name & Username)
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

    const trimmedUser = username.trim().toLowerCase();
    if (trimmedUser && !/^[a-z0-9_]{3,30}$/.test(trimmedUser)) {
      setProfileError("Username must be between 3 and 30 characters (letters, numbers, underscores only).");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const { user } = await api.updateProfile({
        displayName: trimmedName,
        username: trimmedUser || undefined,
      });
      updateProfileState(user);
      setProfileSuccess("Personal information updated successfully.");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Failed to update profile. Please try again.");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  // Helper: client-side image compression & downscaling for seamless avatar upload
  async function prepareAvatarDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read selected image file."));
      reader.onload = () => {
        const rawResult = reader.result as string;
        const img = new Image();
        img.onerror = () => resolve(rawResult); // fallback to raw data URL
        img.onload = () => {
          try {
            const MAX_DIM = 512;
            let { width, height } = img;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(rawResult);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const format = file.type === "image/png" ? "image/png" : "image/jpeg";
            const compressed = canvas.toDataURL(format, 0.88);
            resolve(compressed);
          } catch {
            resolve(rawResult);
          }
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle Photo Picker Selection
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError(null);
    setAvatarSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setAvatarError("Please select a valid image file (JPG, PNG, WebP, or GIF).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. Validate file size (10MB max allowed)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError("Selected image exceeds 10MB limit. Please choose a smaller photo.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // 3. Compress and optimize image for avatar dimensions
      const dataUrl = await prepareAvatarDataUrl(file);
      setAvatarPreview(dataUrl);

      // 4. Send to backend
      const { user } = await api.updateProfile({ avatarUrl: dataUrl });
      updateProfileState(user);
      setAvatarSuccess("Profile photo updated successfully!");
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to upload photo.");
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
      const { user } = await api.updateProfile({ avatarUrl: "" });
      updateProfileState(user);
      setAvatarPreview(null);
      setAvatarSuccess("Profile photo removed.");
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Failed to remove photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const hasPasswordSet = profile?.has_password !== false;

  // Handle Password Update
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (hasPasswordSet && !currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
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
      await api.changePassword({
        currentPassword: currentPassword.trim() ? currentPassword : undefined,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess(
        hasPasswordSet
          ? "Your password has been changed successfully."
          : "Your password has been set successfully.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Failed to update password.");
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
              {profile?.email || "No email specified"}
            </p>
            {username && (
              <p style={{ margin: "2px 0 0", color: "var(--cobalt-600, #2563eb)", fontSize: "0.85rem", fontWeight: 600 }}>
                @{username}
              </p>
            )}

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
          Update your public name and unique username handle seen by your network.
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

          <div className="form-field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="username-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
              Username Handle
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ink-400)",
                  fontWeight: 600,
                }}
              >
                @
              </span>
              <input
                id="username-input"
                type="text"
                className="network-search-input"
                style={{ paddingLeft: "30px" }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                maxLength={30}
                disabled={isUpdatingProfile}
              />
            </div>
            <span style={{ fontSize: "0.76rem", color: "var(--ink-400)", marginTop: "4px", display: "block" }}>
              Letters, numbers, and underscores only (3-30 characters).
            </span>
          </div>

          <div className="form-field" style={{ marginBottom: "1.25rem" }}>
            <label htmlFor="email-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
              Email Address
            </label>
            <input
              id="email-input"
              type="email"
              className="network-search-input"
              value={profile?.email || ""}
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
          Ensure your account uses a strong password of at least 8 characters.
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
          <div className="form-field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="current-password-input" style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
              Current Password {hasPasswordSet ? <span style={{ color: "#ef4444" }}>*</span> : <span style={{ fontSize: "0.8rem", color: "var(--ink-400)", fontWeight: 400 }}>(Optional - Not set yet)</span>}
            </label>
            <input
              id="current-password-input"
              type="password"
              className="network-search-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={hasPasswordSet ? "••••••••" : "Leave blank if not set previously"}
              required={hasPasswordSet}
              disabled={isUpdatingPassword}
              autoComplete="current-password"
            />
          </div>

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
            disabled={isUpdatingPassword || (hasPasswordSet && !currentPassword) || !newPassword || !confirmPassword}
          >
            {isUpdatingPassword ? "Updating Password..." : (hasPasswordSet ? "Update Password" : "Set Password")}
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
              Signed in as <strong>{profile?.email}</strong>. Logging out ends your active authenticated session.
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
