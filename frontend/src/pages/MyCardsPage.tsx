import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import type { CardCatalogSummary, ResourceSummary, ResourceVisibility } from "../types/api";

const VISIBILITY_OPTIONS: ResourceVisibility[] = ["private", "friends", "network"];

function MyCardsPage() {
  const { profile } = useAuth();
  const [cards, setCards] = useState<CardCatalogSummary[]>([]);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [query, setQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"all" | "upi" | "credit" | "debit" | "travel" | "cashback" | "fuel" | "lifestyle" | "visa" | "mastercard" | "rupay" | "amex" | "diners">("all");
  const [selectedCard, setSelectedCard] = useState<CardCatalogSummary | null>(null);
  const [visibility, setVisibility] = useState<ResourceVisibility>("friends");
  const [requestEnabled, setRequestEnabled] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadResources(ownerId: string) {
    setLoading(true);

    try {
      const { resources: ownerResources } = await api.getResources(ownerId);
      setResources(ownerResources);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load your cards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .getCatalogCards()
      .then(({ cards: catalogCards }) => setCards(catalogCards))
      .catch(() => setError("Couldn't load the card catalog. Try refreshing."));
  }, []);

  useEffect(() => {
    if (profile) {
      void loadResources(profile.id);
    }
  }, [profile]);

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cards.filter(
      (card) =>
        (!normalized
          || card.product_name.toLowerCase().includes(normalized)
          || card.issuer.toLowerCase().includes(normalized)
          || card.network.toLowerCase().includes(normalized)
          || (card.variant?.toLowerCase().includes(normalized) ?? false))
        && (catalogFilter === "all"
          || (catalogFilter === "upi" && card.upi_enabled)
          || (catalogFilter === "credit" && card.card_category === "credit")
          || (catalogFilter === "debit" && card.card_category === "debit")
          || (catalogFilter === "visa" && card.network === "Visa")
          || (catalogFilter === "mastercard" && card.network === "Mastercard")
          || (catalogFilter === "rupay" && card.network === "RuPay")
          || (catalogFilter === "amex" && card.network === "American Express")
          || (catalogFilter === "diners" && card.network === "Diners Club")
          || card.use_cases.includes(catalogFilter)),
    );
  }, [cards, catalogFilter, query]);

  const visibleCatalogCards = query.trim() ? filteredCards : filteredCards.slice(0, 12);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  async function handleAdd() {
    if (!profile || !selectedCard) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.createResource({
        owner_id: profile.id,
        card_catalog_id: selectedCard.id,
        visibility,
        request_enabled: requestEnabled,
        notes: notes.trim() || null,
      });
      setNotes("");
      setSuccess(`${selectedCard.issuer} ${selectedCard.product_name} added.`);
      setSelectedCard(null);
      await loadResources(profile.id);
    } catch (addError) {
      setError(addError instanceof ApiError ? addError.message : "Failed to add card");
    }
  }

  async function handleVisibilityChange(resource: ResourceSummary, nextVisibility: ResourceVisibility) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.updateResource(resource.id, profile.id, { visibility: nextVisibility });
      setSuccess("Visibility updated.");
      await loadResources(profile.id);
    } catch (updateError) {
      setError(updateError instanceof ApiError ? updateError.message : "Failed to update visibility");
    }
  }

  async function handleRequestToggle(resource: ResourceSummary) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.updateResource(resource.id, profile.id, { request_enabled: !resource.request_enabled });
      await loadResources(profile.id);
    } catch (updateError) {
      setError(updateError instanceof ApiError ? updateError.message : "Failed to update requests setting");
    }
  }

  async function handleRemove(resource: ResourceSummary) {
    if (!profile) {
      return;
    }

    if (!window.confirm("Remove this card? Friends will no longer be able to discover or request it.")) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.deleteResource(resource.id, profile.id);
      setSuccess("Card removed.");
      await loadResources(profile.id);
    } catch (removeError) {
      setError(removeError instanceof ApiError ? removeError.message : "Failed to remove card");
    }
  }

  return (
    <div className="page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Your collection</span>
          <h1>My Cards</h1>
          <p className="page-intro">Keep the exact cards you can offer, discover, and request help with.</p>
        </div>
        <span className="collection-count">{resources.length} saved</span>
      </div>

      <section>
        <div className="section-heading">
          <div>
            <h2>Add a card</h2>
            <p>Type a bank or card name to find the exact variant.</p>
          </div>
          {!query.trim() && <span className="catalog-hint">Popular cards</span>}
        </div>
        <input
          className="search-input"
          placeholder="Search the catalog..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <label>
          Catalog filter
          <select value={catalogFilter} onChange={(event) => setCatalogFilter(event.target.value as typeof catalogFilter)}>
            <option value="all">All cards</option>
            <option value="upi">UPI-enabled</option>
            <option value="credit">Credit cards</option>
            <option value="debit">Debit cards</option>
            <option value="travel">Travel</option>
            <option value="cashback">Cashback</option>
            <option value="fuel">Fuel</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="rupay">RuPay</option>
            <option value="amex">American Express</option>
            <option value="diners">Diners Club</option>
          </select>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success" role="status">{success}</p>}

        <ul className="catalog-results">
          {visibleCatalogCards.map((card) => (
            <li key={card.id}>
              <span className="catalog-result">
                <strong>{card.issuer} {card.product_name}</strong>
                <small><b>Network:</b> {card.network}</small>
                <small><b>Variant:</b> {card.variant ?? "Standard"}</small>
                {card.upi_enabled && <small className="card-meta">UPI enabled</small>}
                <small>{card.use_cases.slice(0, 3).join(" · ")}</small>
              </span>
              <button className="button-secondary" type="button" onClick={() => setSelectedCard(card)}>
                Choose
              </button>
            </li>
          ))}
        </ul>

        {query.trim() && visibleCatalogCards.length === 0 && (
          <p className="empty-state">No cards match “{query}”. Try an issuer, product, or use-case.</p>
        )}

        {selectedCard && (
          <div className="card-review" aria-live="polite">
            <div className="card-review-heading">
              <div>
                <span className="eyebrow">Selected card</span>
                <h3>{selectedCard.issuer} {selectedCard.product_name}</h3>
                <p>{selectedCard.network}{selectedCard.variant ? ` · ${selectedCard.variant}` : ""} · {selectedCard.card_category}</p>
              </div>
              <button className="button-secondary" type="button" onClick={() => setSelectedCard(null)}>Change</button>
            </div>
            <div className="card-facts">
              <span><b>Network</b>{selectedCard.network}</span>
              <span><b>Variant</b>{selectedCard.variant ?? "Standard"}</span>
              <span><b>UPI</b>{selectedCard.upi_enabled ? "Enabled" : "Not listed"}</span>
              <span><b>Use cases</b>{selectedCard.use_cases.slice(0, 3).join(", ")}</span>
            </div>
            <div className="card-permissions">
              <label>
                Visible to
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as ResourceVisibility)}>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={requestEnabled}
                  onChange={(event) => setRequestEnabled(event.target.checked)}
                />
                <span className="switch" aria-hidden="true" />
                <span>Allow requests</span>
              </label>
              <label>
                Notes <span className="label-optional">optional</span>
                <input value={notes} onChange={(event) => setNotes(event.target.value)} />
                <small>Never enter a card number, CVV, PIN, or OTP here.</small>
              </label>
            </div>
            <button type="button" onClick={() => void handleAdd()}>Save to My Cards</button>
          </div>
        )}
      </section>

      <section>
        <div className="section-heading">
          <div>
            <h2>Your cards</h2>
            <p>Private card metadata, ready for trusted discovery.</p>
          </div>
        </div>
        {loading && <p className="page-status">Loading your cards...</p>}
        {!loading && resources.length === 0 && <p className="empty-state">You haven't added a card yet.</p>}

        <ul className="saved-card-grid">
          {resources.map((resource) => {
            const card = cardsById.get(resource.card_catalog_id);
            return (
              <li key={resource.id}>
                <div className={`visual-card visual-card-${card?.card_category ?? "unknown"}`}>
                  <div className="visual-card-topline">
                    <span>{card?.issuer ?? "Card Crew"}</span>
                    <span>{card?.network ?? "Catalog"}</span>
                  </div>
                  <span className="visual-card-chip" aria-hidden="true" />
                  <div className="visual-card-name">{card ? card.product_name : "Catalog record unavailable"}</div>
                  <div className="visual-card-bottomline">
                    <span>{card?.variant ?? "Saved card"}</span>
                    <span>{card?.upi_enabled ? "UPI" : card?.card_category ?? "Review"}</span>
                  </div>
                </div>
                <div className="resource-identity">
                  <strong>{card ? `${card.issuer} ${card.product_name}` : "Catalog record unavailable"}</strong>
                  {card && <small><b>Network:</b> {card.network} · <b>Variant:</b> {card.variant ?? "Standard"}{card.upi_enabled ? " · UPI enabled" : ""}</small>}
                </div>
                <label className="field-compact">
                  Visible to
                  <select
                    value={resource.visibility}
                    onChange={(event) =>
                      void handleVisibilityChange(resource, event.target.value as ResourceVisibility)
                    }
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={resource.request_enabled}
                    onChange={() => void handleRequestToggle(resource)}
                  />
                  <span className="switch" aria-hidden="true" />
                  <span>Allow requests</span>
                </label>
                <div className="resource-actions">
                  <button className="button-danger" type="button" onClick={() => void handleRemove(resource)}>
                    Remove card
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export { MyCardsPage };
