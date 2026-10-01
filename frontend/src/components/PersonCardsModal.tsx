import { useEffect, useRef } from "react";
import type { PersonCard, UserCard, UserProfile } from "../types/api";
import type { GraphFriend } from "./NetworkGraph";
import { CardTile } from "./CardTile";

export interface PersonCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: GraphFriend | null;
  cards: (PersonCard | UserCard)[] | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  personProfile?: UserProfile | null;
}

export function PersonCardsModal({
  isOpen,
  onClose,
  person,
  cards,
  isLoading,
  error,
  onRetry,
  personProfile,
}: PersonCardsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus modal close button upon opening
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen || !person) {
    return null;
  }

  const displayName = personProfile?.display_name || person.display_name || "Member";
  const avatarUrl = personProfile?.avatar_url || person.avatar_url;
  const titleText = `${displayName}'s Cards`;
  const cardCount = cards ? cards.length : person.card_count || 0;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="person-cards-overlay"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="person-cards-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-cards-modal-title"
      >
        {/* Modal Header */}
        <div className="person-cards-header" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            className="person-modal-avatar"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: person.depth === 1 ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #38bdf8, #0284c7)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "1rem",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              displayName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="person-cards-title-block" style={{ flex: 1, minWidth: 0 }}>
            <h2 id="person-cards-modal-title" className="person-cards-title">
              {titleText}
            </h2>
            <div className="person-cards-subtitle">
              {isLoading ? (
                <span className="subtitle-loading">Fetching shared cards...</span>
              ) : error ? (
                <span className="subtitle-error">Unable to load</span>
              ) : (
                <span className="subtitle-count">
                  {cardCount} {cardCount === 1 ? "card" : "cards"} shared
                  {person.depth === 1 && " · Direct Friend"}
                  {person.depth === 2 && " · Friend of Friend"}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            ref={closeBtnRef}
            className="person-cards-close-btn"
            onClick={onClose}
            aria-label="Close cards dialog"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="person-cards-body">
          {/* 1. Loading State */}
          {isLoading && (
            <div className="person-cards-loading-state" role="status" aria-label="Loading cards">
              <div className="skeleton-cards-grid">
                <div className="skeleton-card-tile">
                  <div className="skeleton-visual-box shimmer" />
                  <div className="skeleton-text-line short shimmer" />
                  <div className="skeleton-text-line full shimmer" />
                </div>
                <div className="skeleton-card-tile">
                  <div className="skeleton-visual-box shimmer" />
                  <div className="skeleton-text-line short shimmer" />
                  <div className="skeleton-text-line full shimmer" />
                </div>
              </div>
              <p className="loading-state-text">Loading {displayName}&rsquo;s cards...</p>
            </div>
          )}

          {/* 2. Error State */}
          {!isLoading && error && (
            <div className="person-cards-error-state" role="alert">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <h3>Unable to load cards</h3>
              <p>Something went wrong while loading {displayName}&rsquo;s cards: {error}</p>
              <button
                type="button"
                className="button-primary-accent"
                onClick={onRetry}
              >
                🔄 Try Again
              </button>
            </div>
          )}

          {/* 3. Empty State */}
          {!isLoading && !error && cards && cards.length === 0 && (
            <div className="person-cards-empty-state">
              <div className="empty-cards-icon" aria-hidden="true">💳</div>
              <h3>No cards available</h3>
              <p>{displayName} hasn&rsquo;t shared any cards with your network visibility depth.</p>
            </div>
          )}

          {/* 4. Loaded Cards Grid */}
          {!isLoading && !error && cards && cards.length > 0 && (
            <div className="person-cards-grid">
              {cards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  ownerName={displayName}
                  ownerAvatarUrl={avatarUrl}
                  relationshipDepth={person.depth}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="person-cards-footer">
          <span className="footer-shield-icon" aria-hidden="true">🛡️</span>
          <span className="footer-safety-text">
            Safe catalog records only. No financial credentials or card numbers stored.
          </span>
          <button
            type="button"
            className="button-secondary btn-sm"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
