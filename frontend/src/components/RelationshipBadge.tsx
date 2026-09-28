import React from "react";

export type RelationshipType =
  | "direct_friend"
  | "friend_of_friend"
  | "incoming_request"
  | "outgoing_request"
  | "blocked"
  | "blocked_me"
  | "none"
  | "self"
  | string;

interface RelationshipBadgeProps {
  relationship: RelationshipType;
  mutualCount?: number;
  className?: string;
}

export function RelationshipBadge({
  relationship,
  mutualCount,
  className = "",
}: RelationshipBadgeProps) {
  switch (relationship) {
    case "direct_friend":
      return (
        <span className={`relationship-badge rel-direct ${className}`}>
          ✓ Direct Friend
        </span>
      );

    case "friend_of_friend":
      return (
        <span className={`relationship-badge rel-fof ${className}`}>
          ✨ Friend of Friend
          {mutualCount && mutualCount > 1 ? ` (${mutualCount} mutual)` : ""}
        </span>
      );

    case "incoming_request":
      return (
        <span className={`relationship-badge rel-pending ${className}`}>
          🔔 Sent you an invite
        </span>
      );

    case "outgoing_request":
      return (
        <span className={`relationship-badge rel-pending ${className}`}>
          ⏳ Invite Pending
        </span>
      );

    case "blocked":
      return (
        <span className={`relationship-badge rel-blocked ${className}`}>
          🛡️ Blocked
        </span>
      );

    case "blocked_me":
      return (
        <span className={`relationship-badge rel-blocked-me ${className}`}>
          🚫 Blocked you
        </span>
      );

    case "self":
      return (
        <span className={`relationship-badge rel-direct ${className}`}>
          👤 You
        </span>
      );

    case "none":
    default:
      return (
        <span className={`relationship-badge rel-outside ${className}`}>
          Outside network
        </span>
      );
  }
}
