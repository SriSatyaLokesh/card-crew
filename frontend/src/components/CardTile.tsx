import React from "react";
import type { UserCard } from "../types/api";

export interface CardTileProps {
  card: UserCard;
  ownerName?: string;
  ownerUsername?: string | null;
  ownerEmail?: string | null;
  ownerAvatarUrl?: string | null;
  relationshipDepth?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CC";
}

export function CardTile({
  card,
  ownerName,
  ownerUsername,
  ownerEmail,
  ownerAvatarUrl,
  relationshipDepth,
}: CardTileProps) {
  // Determine gradient style based on card type
  const typeLower = card.cardType.toLowerCase();
  let cardClass = "visual-card-credit";
  if (typeLower.includes("debit")) {
    cardClass = "visual-card-debit";
  } else if (typeLower.includes("prepaid")) {
    cardClass = "visual-card-prepaid";
  } else if (typeLower.includes("virtual")) {
    cardClass = "visual-card-virtual";
  } else if (
    typeLower.includes("business") ||
    typeLower.includes("corporate") ||
    typeLower.includes("charge")
  ) {
    cardClass = "visual-card-business";
  }

  const isNetworkScope = card.visibilityScope === "TOTAL_NETWORK";
  const displayName = ownerName || "Cardholder";

  return (
    <div className="card-tile-container" role="article" aria-label={`${card.cardName} (${card.cardType})`}>
      {/* 1. Realistic Graphic Card */}
      <div className={`visual-card ${cardClass}`}>
        <div className="visual-card-topline">
          <span className="visual-card-chip-symbol" aria-hidden="true">
            <span className="chip-lines" />
          </span>
          <span className="contactless-symbol" title="Contactless Enabled" aria-hidden="true">
            )))
          </span>
        </div>

        <div className="visual-card-body">
          <div className="visual-card-name" title={card.cardName}>
            {card.cardName.toUpperCase()}
          </div>
        </div>

        <div className="visual-card-bottomline">
          <span className="visual-card-type-label">{card.cardType.toUpperCase()}</span>
          <span
            className="visual-card-visibility-pill"
            title={isNetworkScope ? "Shared across total network" : "Shared with direct friends"}
          >
            {isNetworkScope ? "🌐 Network" : "👥 Direct"}
          </span>
        </div>
      </div>

      {/* 2. Cardholder & Sharing Details Information */}
      <div className="card-tile-meta">
        <div className="card-tile-owner-row">
          <div className="card-tile-avatar">
            {ownerAvatarUrl ? (
              <img src={ownerAvatarUrl} alt={displayName} className="avatar-img" />
            ) : (
              <span>{getInitials(displayName)}</span>
            )}
          </div>
          <div className="card-tile-owner-info">
            <strong className="card-tile-owner-name">{displayName}</strong>
            {ownerUsername && (
              <span className="card-tile-owner-handle">@{ownerUsername}</span>
            )}
            {!ownerUsername && ownerEmail && (
              <span className="card-tile-owner-handle">{ownerEmail}</span>
            )}
          </div>
        </div>

        <div className="card-tile-status-bar">
          <span className="card-tile-share-status">
            {relationshipDepth === 1
              ? "👥 Shared with you · Direct Friend"
              : relationshipDepth === 2
              ? "✨ Shared with you · Extended Network"
              : isNetworkScope
              ? "🌐 Shared with total network"
              : "👥 Shared with direct friends"}
          </span>
          <span className="card-tile-verified-tag">
            ✓ Verified Catalog Record
          </span>
        </div>
      </div>
    </div>
  );
}
