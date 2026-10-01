import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { RelationshipBadge } from "./RelationshipBadge";
import type { RelationshipType } from "./RelationshipBadge";
import { MessageButton } from "./MessageButton";

export interface UserItemData {
  id: string;
  display_name: string;
  email?: string;
  relationship: RelationshipType;
  mutualFriendName?: string | null;
  mutualFriendCount?: number;
  requestId?: string;
  createdAt?: string;
  status?: string;
  avatar_url?: string | null;
}

function formatAvatarUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    const base = (import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, "");
    return `${base}${trimmed}`;
  }
  return trimmed;
}

interface UserListItemProps {
  user: UserItemData;
  onSendInvite?: (userId: string, name: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onDeclineRequest?: (requestId: string) => void;
  onCancelRequest?: (requestId: string) => void;
  onRemoveFriend?: (userId: string, name: string) => void;
  onBlock?: (userId: string, name: string) => void;
  onUnblock?: (userId: string, name: string) => void;
  isBusy?: boolean;
  showMutualDetails?: boolean;
  showBlockOption?: boolean;
  className?: string;
}

export function UserListItem({
  user,
  onSendInvite,
  onAcceptRequest,
  onDeclineRequest,
  onCancelRequest,
  onRemoveFriend,
  onBlock,
  onUnblock,
  isBusy = false,
  showMutualDetails = true,
  showBlockOption = false,
  className = "",
}: UserListItemProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user.avatar_url]);

  const initials = user.display_name.trim().slice(0, 2).toUpperCase() || "U";
  const avatarSrc = formatAvatarUrl(user.avatar_url);
  const showImage = Boolean(avatarSrc && !imgError);

  // Subtitle logic
  let subtitleText: React.ReactNode = null;
  if (user.relationship === "friend_of_friend" && showMutualDetails) {
    subtitleText = (
      <span className="person-subtext fof-highlight">
        🌱 In your extended circle
        {user.mutualFriendName
          ? ` via mutual friend: ${user.mutualFriendName}`
          : user.mutualFriendCount && user.mutualFriendCount > 1
          ? ` (${user.mutualFriendCount} mutual friends)`
          : " (2nd degree friend)"}
      </span>
    );
  } else if (user.relationship === "direct_friend") {
    subtitleText = (
      <span className="person-subtext">
        ✓ Direct Trusted Connection
        {user.createdAt ? ` • Connected ${new Date(user.createdAt).toLocaleDateString()}` : ""}
      </span>
    );
  } else if (user.relationship === "incoming_request") {
    subtitleText = (
      <span className="person-subtext" style={{ color: "var(--cobalt-700)" }}>
        Wants to connect with you
        {user.createdAt ? ` • Sent ${new Date(user.createdAt).toLocaleDateString()}` : ""}
      </span>
    );
  } else if (user.relationship === "outgoing_request") {
    subtitleText = (
      <span className="person-subtext">
        Invitation pending response
        {user.createdAt ? ` • Sent ${new Date(user.createdAt).toLocaleDateString()}` : ""}
      </span>
    );
  } else if (user.relationship === "blocked") {
    subtitleText = (
      <span className="person-subtext" style={{ color: "#ef4444" }}>
        User is currently blocked by you
      </span>
    );
  } else if (user.relationship === "blocked_me") {
    subtitleText = (
      <span className="person-subtext" style={{ color: "#6b7280" }}>
        User has blocked you
      </span>
    );
  } else {
    subtitleText = (
      <span className="person-subtext">
        {user.email ? user.email : `ID: ${user.id.slice(0, 8)}...`}
      </span>
    );
  }

  return (
    <li className={`search-result-item ${className}`}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
        <div
          className="person-avatar"
          style={{
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {showImage ? (
            <img
              src={avatarSrc!}
              alt={user.display_name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setImgError(true)}
            />
          ) : (
            initials
          )}
        </div>
        <div className="person-info">
          <div className="person-name-row">
            <strong>{user.display_name}</strong>
            <RelationshipBadge
              relationship={user.relationship}
              mutualCount={user.mutualFriendCount}
            />
          </div>
          {subtitleText}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {/* Actions according to relationship */}
        {(user.relationship === "none" || user.relationship === "friend_of_friend") && onSendInvite && (
          <button
            type="button"
            className="button-primary-accent btn-sm"
            disabled={isBusy}
            onClick={() => onSendInvite(user.id, user.display_name)}
          >
            {isBusy ? "Sending..." : "+ Connect"}
          </button>
        )}

        {user.relationship === "incoming_request" && user.requestId && (
          <div style={{ display: "flex", gap: "6px" }}>
            {onAcceptRequest && (
              <button
                type="button"
                className="button-primary-accent btn-sm"
                disabled={isBusy}
                onClick={() => onAcceptRequest(user.requestId!)}
              >
                Accept
              </button>
            )}
            {onDeclineRequest && (
              <button
                type="button"
                className="button-secondary btn-sm"
                disabled={isBusy}
                onClick={() => onDeclineRequest(user.requestId!)}
              >
                Decline
              </button>
            )}
          </div>
        )}

        {user.relationship === "outgoing_request" && user.requestId && onCancelRequest && (
          <button
            type="button"
            className="button-secondary btn-sm"
            disabled={isBusy}
            onClick={() => onCancelRequest(user.requestId!)}
          >
            Cancel Invite
          </button>
        )}

        {user.relationship === "friend_of_friend" && (
          <MessageButton
            recipientUserId={user.id}
            recipientName={user.display_name}
            variant="icon"
          />
        )}

        {user.relationship === "direct_friend" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageButton
              recipientUserId={user.id}
              recipientName={user.display_name}
              variant="compact"
            />
            <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 700 }}>
              Connected
            </span>
            {onRemoveFriend && (
              <button
                type="button"
                className="button-secondary btn-sm"
                disabled={isBusy}
                onClick={() => onRemoveFriend(user.id, user.display_name)}
                title="Remove friend"
              >
                Remove
              </button>
            )}
          </div>
        )}

        {user.relationship === "blocked" && onUnblock && (
          <button
            type="button"
            className="button-secondary btn-sm"
            disabled={isBusy}
            onClick={() => onUnblock(user.id, user.display_name)}
          >
            Unblock
          </button>
        )}

        {showBlockOption &&
          user.relationship !== "blocked" &&
          user.relationship !== "blocked_me" &&
          user.relationship !== "self" &&
          onBlock && (
            <button
              type="button"
              className="button-secondary btn-sm"
              style={{ color: "#ef4444" }}
              disabled={isBusy}
              onClick={() => onBlock(user.id, user.display_name)}
              title={`Block ${user.display_name}`}
            >
              Block
            </button>
          )}
      </div>
    </li>
  );
}
