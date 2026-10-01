import type { PersonCard, UserCard } from "../types/api";
import { MessageButton } from "./MessageButton";

export interface CardTileProps {
  card: PersonCard | UserCard;
  ownerId?: string;
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
  ownerId,
  ownerName,
  ownerAvatarUrl,
  relationshipDepth,
}: CardTileProps) {
  const cardName =
    "product_name" in card && card.product_name
      ? `${card.issuer ? `${card.issuer} ` : ""}${card.product_name}`
      : "cardName" in card
      ? card.cardName
      : "Payment Card";

  const category = (
    ("card_category" in card && card.card_category) ||
    ("card_type" in card && card.card_type) ||
    ("cardType" in card && card.cardType) ||
    "credit"
  ).toLowerCase();

  let cardClass = "visual-card-credit";
  if (category.includes("debit")) {
    cardClass = "visual-card-debit";
  } else if (category.includes("prepaid")) {
    cardClass = "visual-card-prepaid";
  } else if (("segment" in card && card.segment === "corporate") || category.includes("business")) {
    cardClass = "visual-card-business";
  }

  const isNetworkScope =
    "visibility_depth" in card ? (card.visibility_depth ?? 1) >= 2 : card.visibilityScope === "TOTAL_NETWORK";
  const displayName = ownerName || "Cardholder";

  const cardTypeLabel =
    "card_type" in card && card.card_type
      ? card.card_type
      : "cardType" in card && card.cardType
      ? card.cardType
      : "Credit";

  const metaSubtitle =
    "network" in card && card.network
      ? `${card.network} · ${card.variant ?? "Standard"}${card.upi_enabled ? " · UPI" : ""}`
      : cardTypeLabel;

  return (
    <div className="card-tile-container" role="article" aria-label={`${cardName} (${cardTypeLabel})`}>
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
          <span className="visual-card-type-label">{cardTypeLabel.toUpperCase()}</span>
          <span
            className="visual-card-visibility-pill"
            title={isNetworkScope ? "Shared across total network" : "Shared with direct friends"}
          >
            {isNetworkScope ? "🌐 Network" : "👥 Direct"}
          </span>
        </div>
      </div>

      {/* 2. Cardholder Info Footer */}
      <div className="card-tile-meta">
        <div className="card-tile-owner-section">
          <div className="card-tile-owner-avatar">
            {ownerAvatarUrl ? (
              <img src={ownerAvatarUrl} alt="" className="card-tile-avatar-img" />
            ) : (
              <span>{getInitials(displayName)}</span>
            )}
          </div>
          <div className="card-tile-owner-info">
            <strong className="card-tile-owner-name">{displayName}</strong>
            <span className="card-tile-owner-handle">{metaSubtitle}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {ownerId && (
            <MessageButton
              recipientUserId={ownerId}
              recipientName={displayName}
              variant="icon"
              className="card-tile-msg-btn"
            />
          )}

          {relationshipDepth !== undefined && (
            <span
              className={`card-tile-rel-badge ${
                relationshipDepth === 1 ? "card-rel-direct" : "card-rel-fof"
              }`}
            >
              {relationshipDepth === 1 ? "1st Degree" : "2nd Degree"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
