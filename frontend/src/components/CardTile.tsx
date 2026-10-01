import type { PersonCard } from "../types/api";

export interface CardTileProps {
  card: PersonCard;
  ownerName?: string;
  ownerAvatarUrl?: string | null;
  relationshipDepth?: number;
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CC"
  );
}

export function CardTile({
  card,
  ownerName,
  ownerAvatarUrl,
  relationshipDepth,
}: CardTileProps) {
  const cardName = card.product_name
    ? `${card.issuer ? `${card.issuer} ` : ""}${card.product_name}`
    : "Payment Card";

  const category = (card.card_category || card.card_type || "credit").toLowerCase();
  let cardClass = "visual-card-credit";
  if (category.includes("debit")) {
    cardClass = "visual-card-debit";
  } else if (category.includes("prepaid")) {
    cardClass = "visual-card-prepaid";
  } else if (card.segment === "corporate") {
    cardClass = "visual-card-business";
  }

  const isNetworkScope = card.visibility_depth >= 2;
  const displayName = ownerName || "Cardholder";

  return (
    <div className="card-tile-container" role="article" aria-label={`${cardName} (${card.card_type || "Card"})`}>
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
          <div className="visual-card-name" title={cardName}>
            {cardName.toUpperCase()}
          </div>
        </div>

        <div className="visual-card-bottomline">
          <span className="visual-card-type-label">{(card.card_type || card.card_category || "Credit").toUpperCase()}</span>
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
            <span className="card-tile-owner-handle">
              {card.network} · {card.variant ?? "Standard"}
              {card.upi_enabled ? " · UPI" : ""}
            </span>
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
