import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/apiClient";
import { resolveDisplayNames } from "../lib/resolveNames";
import { NetworkGraph } from "../components/NetworkGraph";
import type { GraphFriend } from "../components/NetworkGraph";
import { RequestComposeModal } from "../components/RequestComposeModal";
import type { CardCatalogSummary, NetworkMatch } from "../types/api";

type MatchWithName = NetworkMatch & { display_name: string };

function HomePage() {
  const { profile } = useAuth();
  const [cards, setCards] = useState<CardCatalogSummary[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [friends, setFriends] = useState<GraphFriend[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardCatalogSummary | null>(null);
  const [matches, setMatches] = useState<MatchWithName[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [composeMatch, setComposeMatch] = useState<MatchWithName | null>(null);
  const [requestSentFor, setRequestSentFor] = useState<string | null>(null);
  const [searchDepth, setSearchDepth] = useState<1 | 2>(1);

  useEffect(() => {
    api
      .getCatalogCards()
      .then(({ cards: catalogCards }) => setCards(catalogCards))
      .catch(() => setCardsError("Couldn't load the card catalog. Try refreshing."))
      .finally(() => setCardsLoading(false));
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    api
      .getConnections(profile.id, "accepted")
      .then(({ connections }) => {
        const friendIds = connections.map((connection) => ({
          user_id: connection.requester_id === profile.id ? connection.addressee_id : connection.requester_id,
          depth: 1 as const,
          card_count: 0,
          via_user_id: null,
        }));
        return resolveDisplayNames(friendIds);
      })
      .then(setFriends)
      .catch(() => setFriends([]));
  }, [profile]);

  const suggestions = useMemo(() => {
    if (!query.trim() || selectedCard) {
      return [];
    }

    const normalized = query.trim().toLowerCase();
    return cards.filter(
      (card) =>
        card.product_name.toLowerCase().includes(normalized)
        || card.issuer.toLowerCase().includes(normalized)
        || card.network.toLowerCase().includes(normalized)
        || (card.variant?.toLowerCase().includes(normalized) ?? false),
    );
  }, [cards, query, selectedCard]);

  async function handleSelectCard(card: CardCatalogSummary) {
    if (!profile) {
      return;
    }

    setSelectedCard(card);
    setQuery(`${card.issuer} ${card.product_name}`);
    setMatches(null);
    setSearchLoading(true);
    setSearchError(null);
    setRequestSentFor(null);

    try {
      const { matches: networkMatches } = await api.searchNetwork(profile.id, card.id, searchDepth);
      const withNames = await resolveDisplayNames(networkMatches);
      setMatches(withNames);
    } catch (searchErr) {
      setSearchError(searchErr instanceof Error ? searchErr.message : "Search failed. Try again.");
    } finally {
      setSearchLoading(false);
    }
  }

  const highlightedUserIds = useMemo(
    () => new Set((matches ?? []).map((match) => match.user_id)),
    [matches],
  );

  return (
    <div className="page">
      <h1>Find help from people you trust</h1>

      {cardsLoading && <p className="page-status">Loading the card catalog...</p>}
      {cardsError && <p className="form-error">{cardsError}</p>}

      <input
        className="search-input"
        placeholder="Search a card..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedCard(null);
          setMatches(null);
          setSearchError(null);
        }}
      />

      <label className="field-compact search-depth-control">
        Search within
        <select value={searchDepth} onChange={(event) => setSearchDepth(Number(event.target.value) as 1 | 2)}>
          <option value={1}>Direct friends</option>
          <option value={2}>Friends of friends</option>
        </select>
      </label>

      {!selectedCard && suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((card) => (
            <li key={card.id}>
              <button type="button" onClick={() => void handleSelectCard(card)}>
                <strong>{card.issuer} {card.product_name}</strong>
                <small><b>Network:</b> {card.network}</small>
                <small><b>Variant:</b> {card.variant ?? "Standard"}</small>
                {card.upi_enabled && <small className="card-meta">UPI enabled</small>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!selectedCard && !query.trim() && !cardsLoading && (
        <p className="empty-state">Search a card to see whether a direct friend can help.</p>
      )}

      {searchLoading && <p className="page-status" role="status">Searching your network...</p>}
      {searchError && <p className="form-error" role="alert">{searchError}</p>}

      {selectedCard && matches !== null && (
        <section>
          <h2>
            {selectedCard.issuer} {selectedCard.product_name}
          </h2>
          <p className="selection-subtitle">
            Network: <strong>{selectedCard.network}</strong> · Variant: <strong>{selectedCard.variant ?? "Standard"}</strong>
          </p>

          {matches.length === 0 ? (
            <div className="empty-state">
              <p>No match in your trusted network.</p>
              <Link to="/network">Invite a friend</Link>
            </div>
          ) : (
            <ul className="match-list">
              {matches.map((match) => (
                <li key={match.user_id}>
                  <strong>{match.display_name}</strong>
                  <span className="match-resource">{selectedCard.issuer} {selectedCard.product_name}</span>
                  <span className={`badge ${match.depth === 1 ? "badge-direct" : "badge-second-degree"}`}>
                    {match.depth === 1 ? "Direct friend" : "2nd degree"}
                  </span>
                  {match.depth === 2 && <span className="match-resource">Referral needed</span>}
                  <span className={`badge ${match.requestable ? "badge-requestable" : "badge-unavailable"}`}>
                    {match.requestable ? "Can request" : "Requests unavailable"}
                  </span>
                  {match.requestable && (
                    requestSentFor === match.resource_id ? (
                      <span className="form-success">Request sent</span>
                    ) : (
                      <button type="button" onClick={() => setComposeMatch(match)}>
                        Request help
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <NetworkGraph
        selfName={profile?.display_name ?? "You"}
        friends={friends}
        highlightedUserIds={highlightedUserIds}
        searchActive={selectedCard !== null && matches !== null}
      />

      {composeMatch && profile && selectedCard && (
        <RequestComposeModal
          requesterId={profile.id}
          ownerId={composeMatch.user_id}
          ownerName={composeMatch.display_name}
          resourceId={composeMatch.resource_id}
          cardLabel={`${selectedCard.issuer} ${selectedCard.product_name}`}
          onClose={() => setComposeMatch(null)}
          onSent={() => {
            setRequestSentFor(composeMatch.resource_id);
            setComposeMatch(null);
          }}
        />
      )}
    </div>
  );
}

export { HomePage };
