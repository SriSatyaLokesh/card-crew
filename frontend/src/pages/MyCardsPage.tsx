import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { CardModal } from "../components/CardModal";
import { SavedCardItem } from "../components/SavedCardItem";
import type { CardCatalogSummary, UserCard } from "../types/api";

export function MyCardsPage() {
  const { profile } = useAuth();

  // User's saved cards
  const [savedCards, setSavedCards] = useState<UserCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Card catalog
  const [catalogCards, setCatalogCards] = useState<CardCatalogSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Catalog search & filter
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<string>("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedTypeFilter, setAppliedTypeFilter] = useState<string>("all");

  // Add/Edit Card Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<UserCard | null>(null);
  const [modalInitialName, setModalInitialName] = useState("");
  const [modalInitialType, setModalInitialType] = useState("Credit Card");
  const [modalInitialScope, setModalInitialScope] = useState<"DIRECT_FRIENDS" | "TOTAL_NETWORK">("DIRECT_FRIENDS");

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load user saved cards
  async function loadUserCards() {
    if (!profile) return;
    setLoadingCards(true);
    try {
      const { cards } = await api.getCards(profile.id);
      setSavedCards(cards);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load saved cards");
    } finally {
      setLoadingCards(false);
    }
  }

  // Load catalog cards
  useEffect(() => {
    setLoadingCatalog(true);
    api
      .getCatalogCards()
      .then(({ cards }) => {
        setCatalogCards(cards);
      })
      .catch(() => {
        // non-blocking
      })
      .finally(() => {
        setLoadingCatalog(false);
      });
  }, []);

  useEffect(() => {
    if (profile) {
      void loadUserCards();
    }
  }, [profile]);

  // Handle Apply Filter
  function handleApplyFilter(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setAppliedSearch(catalogSearch);
    setAppliedTypeFilter(catalogTypeFilter);
  }

  // Handle Clear Filter
  function handleClearFilter() {
    setCatalogSearch("");
    setCatalogTypeFilter("all");
    setAppliedSearch("");
    setAppliedTypeFilter("all");
  }

  // Filtered Catalog Cards
  const filteredCatalogCards = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    const typeF = appliedTypeFilter.toLowerCase();

    return catalogCards.filter((card) => {
      // 1. Name search
      const matchesSearch =
        !q ||
        card.product_name.toLowerCase().includes(q) ||
        card.issuer.toLowerCase().includes(q);

      // 2. Type filter
      let matchesType = true;
      if (typeF !== "all") {
        const cat = card.card_category?.toLowerCase() || card.card_type?.toLowerCase() || "";
        if (typeF === "credit") {
          matchesType = cat.includes("credit");
        } else if (typeF === "debit") {
          matchesType = cat.includes("debit");
        } else if (typeF === "prepaid") {
          matchesType = cat.includes("prepaid");
        } else if (typeF === "charge") {
          matchesType = cat.includes("charge");
        }
      }

      return matchesSearch && matchesType;
    });
  }, [catalogCards, appliedSearch, appliedTypeFilter]);

  // Open modal for manual card creation
  function handleOpenAddModal() {
    setEditingCard(null);
    setModalInitialName("");
    setModalInitialType("Credit Card");
    setModalInitialScope("DIRECT_FRIENDS");
    setIsModalOpen(true);
  }

  // Open modal from Catalog selection pre-filled with ONLY Card Name & Card Type
  function handleSelectFromCatalog(catalogCard: CardCatalogSummary) {
    setEditingCard(null);
    const fullName = `${catalogCard.issuer} ${catalogCard.product_name}`.trim();
    const rawCategory = catalogCard.card_category || catalogCard.card_type || "credit";
    const mappedType =
      rawCategory.toLowerCase() === "debit"
        ? "Debit Card"
        : rawCategory.toLowerCase() === "prepaid"
        ? "Prepaid Card"
        : "Credit Card";

    setModalInitialName(fullName);
    setModalInitialType(mappedType);
    setModalInitialScope("DIRECT_FRIENDS");
    setIsModalOpen(true);
  }

  // Open modal for editing an existing card
  function handleOpenEditModal(card: UserCard) {
    setEditingCard(card);
    setModalInitialName(card.cardName);
    setModalInitialType(card.cardType);
    setModalInitialScope(card.visibilityScope || "DIRECT_FRIENDS");
    setIsModalOpen(true);
  }

  // Save Card Handler (Add or Edit) - receives Card Name, Card Type, and visibilityScope
  async function handleSaveCard(
    cardName: string,
    cardType: string,
    visibilityScope: "DIRECT_FRIENDS" | "TOTAL_NETWORK",
  ) {
    setError(null);
    setSuccess(null);

    if (editingCard) {
      await api.updateCard(editingCard.id, { cardName, cardType, visibilityScope });
      setSuccess(`Updated "${cardName}" successfully.`);
    } else {
      await api.createCard({ cardName, cardType, visibilityScope });
      setSuccess(`Added "${cardName}" to your cards.`);
    }

    await loadUserCards();
  }

  // Delete Card Handler
  async function handleDeleteCard(cardId: string, cardName: string) {
    if (!window.confirm(`Are you sure you want to delete "${cardName}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingCardId(cardId);

    try {
      await api.deleteCard(cardId);
      setSuccess(`Removed "${cardName}" from your cards.`);
      await loadUserCards();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete card");
    } finally {
      setDeletingCardId(null);
    }
  }

  return (
    <div className="page">
      {/* 1. Header Area */}
      <div
        className="page-heading-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--paper-200)",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>My Cards</h1>
          <p className="page-intro" style={{ margin: "4px 0 0" }}>
            Manage your saved cards
          </p>
        </div>

        <button
          type="button"
          className="button-primary-accent"
          style={{ minHeight: "44px", fontSize: "0.95rem" }}
          onClick={handleOpenAddModal}
        >
          + Add Card
        </button>
      </div>

      {/* Global Status Notifications */}
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "1rem" }}>
          ⚠️ {error}
        </p>
      )}
      {success && (
        <p className="form-success" role="status" style={{ marginTop: "1rem" }}>
          ✓ {success}
        </p>
      )}

      {/* 2. MY CARDS Section */}
      <section style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            My Cards
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--ink-600)", fontWeight: 600 }}>
            {savedCards.length} {savedCards.length === 1 ? "card" : "cards"} saved
          </span>
        </div>

        {loadingCards && <p className="page-status">Loading your saved cards...</p>}

        {/* Empty State */}
        {!loadingCards && savedCards.length === 0 && (
          <div
            className="empty-state"
            style={{
              textAlign: "center",
              padding: "3rem 1.5rem",
              background: "var(--white)",
              borderRadius: "var(--radius-lg)",
              border: "1px dashed var(--paper-200)",
              margin: "1rem 0",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💳</div>
            <h3 style={{ margin: "0 0 0.5rem" }}>No cards saved yet</h3>
            <p style={{ maxWidth: "38ch", margin: "0 auto 1.5rem", color: "var(--ink-600)" }}>
              Add your first card to start building your card collection.
            </p>
            <button
              type="button"
              className="button-primary-accent"
              onClick={handleOpenAddModal}
            >
              + Add Card
            </button>
          </div>
        )}

        {/* Saved Cards Visual Grid */}
        {!loadingCards && savedCards.length > 0 && (
          <ul className="saved-cards-grid">
            {savedCards.map((card) => (
              <li key={card.id}>
                <SavedCardItem
                  card={card}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteCard}
                  isDeleting={deletingCardId === card.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. CARD CATALOG Section */}
      <section style={{ marginTop: "3.5rem", paddingTop: "2rem", borderTop: "1px solid var(--paper-200)" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Card Catalog
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "var(--ink-600)" }}>
            Select any card to pre-fill your card details and quickly save it to your collection.
          </p>
        </div>

        {/* Simplified Catalog Filtering */}
        <form
          onSubmit={handleApplyFilter}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "flex-end",
            background: "var(--white)",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--paper-200)",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ flex: "1 1 240px", minWidth: "200px" }}>
            <label
              htmlFor="catalog-search-input"
              style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px", color: "var(--ink-700)" }}
            >
              Search Card
            </label>
            <input
              id="catalog-search-input"
              type="search"
              className="network-search-input"
              placeholder="Search card name (e.g. Regalia, Millennia, SimplySAVE)..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              style={{ minHeight: "42px" }}
            />
          </div>

          <div style={{ flex: "0 1 180px", minWidth: "150px" }}>
            <label
              htmlFor="catalog-type-filter"
              style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px", color: "var(--ink-700)" }}
            >
              Card Type
            </label>
            <select
              id="catalog-type-filter"
              value={catalogTypeFilter}
              onChange={(e) => setCatalogTypeFilter(e.target.value)}
              style={{
                width: "100%",
                minHeight: "42px",
                padding: "0 10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--paper-200)",
                fontSize: "0.9rem",
                background: "var(--white)",
              }}
            >
              <option value="all">All</option>
              <option value="credit">Credit Card</option>
              <option value="debit">Debit Card</option>
              <option value="prepaid">Prepaid Card</option>
              <option value="charge">Charge Card</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="button-secondary"
              style={{ minHeight: "42px", padding: "0 14px" }}
              onClick={handleClearFilter}
            >
              Clear
            </button>
            <button
              type="submit"
              className="button-primary-accent"
              style={{ minHeight: "42px", padding: "0 16px" }}
            >
              Apply
            </button>
          </div>
        </form>

        {loadingCatalog && <p className="page-status">Loading card catalog...</p>}

        {!loadingCatalog && filteredCatalogCards.length === 0 && (
          <p className="empty-state">
            No cards found matching your criteria. Try adjusting your search or filter.
          </p>
        )}

        {/* Catalog Cards Grid */}
        {!loadingCatalog && filteredCatalogCards.length > 0 && (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
              padding: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {filteredCatalogCards.slice(0, 18).map((card) => {
              const rawType = card.card_category || card.card_type;
              const displayType =
                rawType === "debit"
                  ? "Debit Card"
                  : rawType === "prepaid"
                  ? "Prepaid Card"
                  : "Credit Card";

              return (
                <li
                  key={card.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "1rem 1.25rem",
                    background: "var(--white)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--paper-200)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--ink-950)" }}>
                        {card.issuer} {card.product_name}
                      </strong>
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "var(--cobalt-700)",
                        background: "var(--cobalt-50)",
                        padding: "2px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      {displayType}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button-primary-accent btn-sm"
                    style={{ alignSelf: "flex-end", minWidth: "90px" }}
                    onClick={() => handleSelectFromCatalog(card)}
                  >
                    + Select Card
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 4. Add / Edit Card Modal */}
      <CardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCard}
        initialCardName={modalInitialName}
        initialCardType={modalInitialType}
        initialVisibilityScope={modalInitialScope}
        isEditing={Boolean(editingCard)}
      />
    </div>
  );
}

export default MyCardsPage;
