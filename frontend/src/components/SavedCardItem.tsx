import React from "react";
import type { UserCard } from "../types/api";

interface SavedCardItemProps {
  card: UserCard;
  onEdit: (card: UserCard) => void;
  onDelete: (cardId: string, cardName: string) => void;
  isDeleting?: boolean;
}

export function SavedCardItem({
  card,
  onEdit,
  onDelete,
  isDeleting = false,
}: SavedCardItemProps) {
  // Determine gradient style based on card type
  const typeLower = card.cardType.toLowerCase();
  let cardClass = "visual-card-credit";
  if (typeLower.includes("debit")) {
    cardClass = "visual-card-debit";
  } else if (typeLower.includes("prepaid")) {
    cardClass = "visual-card-prepaid";
  } else if (typeLower.includes("virtual")) {
    cardClass = "visual-card-virtual";
  } else if (typeLower.includes("business") || typeLower.includes("corporate") || typeLower.includes("charge")) {
    cardClass = "visual-card-business";
  }

  return (
    <div className="saved-card-container">
      {/* 1. Visual Financial Card Graphic */}
      <div className={`visual-card ${cardClass}`}>
        <div className="visual-card-topline">
          <span className="visual-card-chip-symbol" aria-hidden="true">
            <span className="chip-lines" />
          </span>
          <span className="contactless-symbol" title="Contactless Enabled">
            )))
          </span>
        </div>

        <div className="visual-card-body">
          <div className="visual-card-name" title={card.cardName}>
            {card.cardName.toUpperCase()}
          </div>
        </div>

        <div className="visual-card-bottomline">
          <span className="visual-card-type-label">
            {card.cardType.toUpperCase()}
          </span>
          <span
            className="visual-card-visibility-pill"
            style={{
              fontSize: "0.68rem",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
            title={card.visibilityScope === "TOTAL_NETWORK" ? "Shared with direct friends & friends of friends" : "Shared with direct friends only"}
          >
            {card.visibilityScope === "TOTAL_NETWORK" ? "🌐 Network" : "👥 Direct"}
          </span>
        </div>
      </div>

      {/* 2. Card Management Action Bar */}
      <div className="saved-card-actions">
        <button
          type="button"
          className="button-secondary btn-sm"
          onClick={() => onEdit(card)}
          disabled={isDeleting}
        >
          Edit
        </button>
        <button
          type="button"
          className="button-secondary btn-sm"
          style={{ color: "#ef4444" }}
          onClick={() => onDelete(card.id, card.cardName)}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
