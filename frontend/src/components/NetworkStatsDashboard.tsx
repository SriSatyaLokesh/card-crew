import React from "react";
import type { NetworkStats } from "../types/api";

export type NetworkTabType =
  | "all"
  | "incoming"
  | "pending"
  | "friends"
  | "fof"
  | "blocked"
  | "cards";

interface NetworkStatsDashboardProps {
  stats: NetworkStats | null;
  loading?: boolean;
  activeTab?: string;
  onSelectTab?: (tab: NetworkTabType) => void;
}

export function NetworkStatsDashboard({
  stats,
  loading = false,
  activeTab,
  onSelectTab,
}: NetworkStatsDashboardProps) {
  const cards: Array<{
    id: string;
    targetTab: NetworkTabType;
    label: string;
    count: number;
    icon: string;
    description: string;
  }> = [
    {
      id: "total_requests",
      targetTab: "incoming",
      label: "Total Requests",
      count: stats?.totalRequests ?? 0,
      icon: "📬",
      description: "Incoming + Outgoing pending",
    },
    {
      id: "direct_friends",
      targetTab: "friends",
      label: "Direct Friends",
      count: stats?.directFriends ?? 0,
      icon: "👥",
      description: "Direct trusted connections",
    },
    {
      id: "friends_of_friends",
      targetTab: "fof",
      label: "Friends of Friends",
      count: stats?.friendsOfFriends ?? 0,
      icon: "🌱",
      description: "2-hop extended circle",
    },
    {
      id: "incoming_requests",
      targetTab: "incoming",
      label: "Incoming Requests",
      count: stats?.incomingRequests ?? 0,
      icon: "📥",
      description: "Awaiting your response",
    },
    {
      id: "pending_requests",
      targetTab: "pending",
      label: "Pending Requests",
      count: stats?.pendingRequests ?? 0,
      icon: "📤",
      description: "Sent invitations awaiting answer",
    },
  ];

  return (
    <div className="network-stats-row" role="region" aria-label="Network Statistics Dashboard">
      {cards.map((card) => {
        const isClickable = Boolean(onSelectTab);
        const isActive = activeTab === card.targetTab;

        return (
          <div
            key={card.id}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={() => onSelectTab && onSelectTab(card.targetTab)}
            onKeyDown={(e) => {
              if (isClickable && onSelectTab && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelectTab(card.targetTab);
              }
            }}
            className={`network-stat-pill ${isClickable ? "clickable" : ""} ${isActive ? "active" : ""}`}
            title={card.description}
          >
            <span className="stat-pill-icon">{card.icon}</span>
            <div className="stat-pill-data">
              <span className="stat-pill-num">
                {loading ? "..." : card.count}
              </span>
              <span className="stat-pill-label">{card.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
