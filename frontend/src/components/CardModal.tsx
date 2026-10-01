import React, { useState, useEffect } from "react";

export const SUPPORTED_CARD_TYPES = [
  "Credit Card",
  "Debit Card",
  "Prepaid Card",
  "Virtual Card",
  "Business Card",
] as const;

export type CardTypeOption = (typeof SUPPORTED_CARD_TYPES)[number];

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardName: string, cardType: string, visibilityScope: "DIRECT_FRIENDS" | "TOTAL_NETWORK") => Promise<void>;
  initialCardName?: string;
  initialCardType?: string;
  initialVisibilityScope?: "DIRECT_FRIENDS" | "TOTAL_NETWORK";
  isEditing?: boolean;
}

export function CardModal({
  isOpen,
  onClose,
  onSave,
  initialCardName = "",
  initialCardType = "Credit Card",
  initialVisibilityScope = "DIRECT_FRIENDS",
  isEditing = false,
}: CardModalProps) {
  const [cardName, setCardName] = useState(initialCardName);
  const [cardType, setCardType] = useState<string>(initialCardType);
  const [visibilityScope, setVisibilityScope] = useState<"DIRECT_FRIENDS" | "TOTAL_NETWORK">(
    initialVisibilityScope || "DIRECT_FRIENDS",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCardName(initialCardName);
      setCardType(initialCardType || "Credit Card");
      setVisibilityScope(initialVisibilityScope || "DIRECT_FRIENDS");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialCardName, initialCardType, initialVisibilityScope]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = cardName.trim();
    if (!trimmed) {
      setError("Card Name is required.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Card Name must be 100 characters or fewer.");
      return;
    }
    if (!cardType) {
      setError("Card Type is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSave(trimmed, cardType, visibilityScope);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save card. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content card-form-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="card-modal-title" style={{ margin: 0, fontSize: "1.35rem" }}>
              {isEditing ? "Edit Card" : "Add Card"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--ink-600)" }}>
              {isEditing
                ? "Update your card name or type."
                : "Enter your card name and select card type to save."}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert" style={{ margin: "1rem 0 0.5rem" }}>
            ⚠️ {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
          {/* 1. Card Name */}
          <div className="form-field" style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="card-name-input"
              style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}
            >
              Card Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="card-name-input"
              type="text"
              className="network-search-input"
              placeholder="e.g. HDFC Regalia, SBI SimplySAVE, My Travel Card"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              autoFocus
              required
              disabled={isSubmitting}
              maxLength={100}
            />
          </div>

          {/* 2. Card Type */}
          <div className="form-field" style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="card-type-select"
              style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}
            >
              Card Type <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="card-type-select"
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                minHeight: "48px",
                padding: "0 12px",
                fontSize: "0.95rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--paper-200)",
                background: "var(--white)",
              }}
            >
              {SUPPORTED_CARD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Who can see this card? */}
          <div className="form-field" style={{ marginBottom: "1.5rem" }}>
            <label
              style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "8px" }}
            >
              Who can see this card? <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ display: "grid", gap: "10px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: visibilityScope === "DIRECT_FRIENDS"
                    ? "2px solid var(--cobalt-600, #2563eb)"
                    : "1px solid var(--paper-200)",
                  background: visibilityScope === "DIRECT_FRIENDS" ? "var(--cobalt-100, #eff6ff)" : "var(--white)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="visibilityScope"
                  value="DIRECT_FRIENDS"
                  checked={visibilityScope === "DIRECT_FRIENDS"}
                  onChange={() => setVisibilityScope("DIRECT_FRIENDS")}
                  disabled={isSubmitting}
                  style={{ marginTop: "3px", accentColor: "#2563eb" }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--ink-950)" }}>
                    Direct Friends
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--ink-600)", marginTop: "2px" }}>
                    Only people directly connected to me
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: visibilityScope === "TOTAL_NETWORK"
                    ? "2px solid var(--cobalt-600, #2563eb)"
                    : "1px solid var(--paper-200)",
                  background: visibilityScope === "TOTAL_NETWORK" ? "var(--cobalt-100, #eff6ff)" : "var(--white)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="visibilityScope"
                  value="TOTAL_NETWORK"
                  checked={visibilityScope === "TOTAL_NETWORK"}
                  onChange={() => setVisibilityScope("TOTAL_NETWORK")}
                  disabled={isSubmitting}
                  style={{ marginTop: "3px", accentColor: "#2563eb" }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--ink-950)" }}>
                    Total Network
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--ink-600)", marginTop: "2px" }}>
                    My friends and friends of friends
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              paddingTop: "1rem",
              borderTop: "1px solid var(--paper-200)",
            }}
          >
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary-accent"
              disabled={isSubmitting || !cardName.trim()}
            >
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Save Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
