import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { resolveUserProfile } from "../lib/resolveNames";
import { NetworkGraph } from "../components/NetworkGraph";
import type { GraphFriend } from "../components/NetworkGraph";
import { PersonCardsModal } from "../components/PersonCardsModal";
import type {
  BlockedUserSummary,
  FriendRequestSummary,
  FriendshipSummary,
  NetworkEdge,
  NetworkNode,
  PersonCard,
} from "../types/api";

type EnrichedFriendship = FriendshipSummary & {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
};
type EnrichedRequest = FriendRequestSummary & {
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
};
type EnrichedBlock = BlockedUserSummary & {
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
};

function MyNetworkPage() {
  const { profile } = useAuth();
  const [friendships, setFriendships] = useState<EnrichedFriendship[]>([]);
  const [incoming, setIncoming] = useState<EnrichedRequest[]>([]);
  const [outgoing, setOutgoing] = useState<EnrichedRequest[]>([]);
  const [blocked, setBlocked] = useState<EnrichedBlock[]>([]);
  const [inviteId, setInviteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [graphDepth, setGraphDepth] = useState<1 | 2>(2);
  const [graphNodes, setGraphNodes] = useState<NetworkNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<NetworkEdge[]>([]);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphFriend | null>(null);

  // Person Cards Modal State
  const [modalPerson, setModalPerson] = useState<GraphFriend | null>(null);
  const [personCards, setPersonCards] = useState<PersonCard[] | null>(null);
  const [personCardsLoading, setPersonCardsLoading] = useState(false);
  const [personCardsError, setPersonCardsError] = useState<string | null>(null);

  // Search by name state
  const [nameSearch, setNameSearch] = useState("");
  const [nameSearchResults, setNameSearchResults] = useState<Array<{ id: string; display_name: string; avatar_url: string | null }>>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);

  async function loadNetwork(selfId: string) {
    setLoading(true);
    setError(null);

    try {
      const [{ friendships: allFriendships }, { requests: pending }, { blocks }] = await Promise.all([
        api.getFriendships(),
        api.getPendingFriendRequests(),
        api.getBlockedUsers(),
      ]);

      const [friendshipsEnriched, incomingEnriched, outgoingEnriched, blockedEnriched] = await Promise.all([
        Promise.all(
          allFriendships.map(async (f) => {
            const counterpartyId = f.user_a === selfId ? f.user_b : f.user_a;
            const user = await resolveUserProfile(counterpartyId);
            return {
              ...f,
              counterpartyId,
              counterpartyName: user.display_name,
              counterpartyAvatarUrl: user.avatar_url,
            };
          }),
        ),
        Promise.all(
          pending
            .filter((r) => r.addressee_id === selfId)
            .map(async (r) => {
              const user = await resolveUserProfile(r.requester_id);
              return {
                ...r,
                counterpartyName: user.display_name,
                counterpartyAvatarUrl: user.avatar_url,
              };
            }),
        ),
        Promise.all(
          pending
            .filter((r) => r.requester_id === selfId)
            .map(async (r) => {
              const user = await resolveUserProfile(r.addressee_id);
              return {
                ...r,
                counterpartyName: user.display_name,
                counterpartyAvatarUrl: user.avatar_url,
              };
            }),
        ),
        Promise.all(
          blocks.map(async (b) => {
            const user = await resolveUserProfile(b.blocked_id);
            return {
              ...b,
              counterpartyName: user.display_name,
              counterpartyAvatarUrl: user.avatar_url,
            };
          }),
        ),
      ]);

      setFriendships(friendshipsEnriched);
      setIncoming(incomingEnriched);
      setOutgoing(outgoingEnriched);
      setBlocked(blockedEnriched);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load your network");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) {
      void loadNetwork(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    api
      .getNetworkGraph(graphDepth)
      .then(({ nodes, edges }) => {
        setGraphNodes(nodes);
        setGraphEdges(edges);
      })
      .catch(() => {
        setGraphNodes([]);
        setGraphEdges([]);
      });
  }, [graphDepth, profile, friendships]);

  async function handleOpenPersonCards(person: GraphFriend) {
    setModalPerson(person);
    setPersonCards(null);
    setPersonCardsLoading(true);
    setPersonCardsError(null);

    try {
      const { cards } = await api.getPersonCards(person.user_id);
      setPersonCards(cards);
    } catch (err) {
      setPersonCardsError(err instanceof Error ? err.message : "Failed to load cards for this person.");
    } finally {
      setPersonCardsLoading(false);
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();

    if (!profile || !inviteId.trim()) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.sendFriendRequest(inviteId.trim());
      setInviteId("");
      setSuccess("Invite sent.");
      await loadNetwork(profile.id);
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : "Failed to send invite");
    }
  }

  async function handleSendInviteToId(targetId: string) {
    if (!profile || !targetId) return;
    setError(null);
    setSuccess(null);

    try {
      await api.sendFriendRequest(targetId);
      setSuccess("Friend request sent.");
      setNameSearchResults([]);
      setNameSearch("");
      await loadNetwork(profile.id);
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : "Failed to send request");
    }
  }

  async function handleSearchName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameSearch.trim()) return;
    setNameSearchLoading(true);
    try {
      const { users } = await api.searchUsers(nameSearch.trim());
      setNameSearchResults(users.filter((u) => u.id !== profile?.id));
    } catch {
      setNameSearchResults([]);
    } finally {
      setNameSearchLoading(false);
    }
  }

  async function handleAccept(requestId: string) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.acceptFriendRequest(requestId);
      setSuccess("Connection accepted.");
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to accept connection");
    }
  }

  async function handleDeclineOrCancel(requestId: string) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.declineFriendRequest(requestId);
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to update request");
    }
  }

  async function handleRemoveFriend(friendId: string) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.removeFriend(friendId);
      setSuccess("Connection removed.");
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to remove connection");
    }
  }

  async function handleBlock(targetId: string) {
    if (!profile) {
      return;
    }

    if (!window.confirm("Blocking removes this connection and prevents future requests between you.")) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.blockUser(targetId);
      setSuccess("Connection blocked.");
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to block connection");
    }
  }

  const graphFriends = useMemo(
    () => graphNodes.filter((node) => node.depth > 0) as GraphFriend[],
    [graphNodes],
  );

  return (
    <div className="page">
      <h1>My Network</h1>

      {/* 1. Search & Invite Users */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Find & Connect</h2>
        <form onSubmit={handleSearchName} style={{ display: "flex", gap: "10px", marginBottom: "1rem" }}>
          <input
            className="search-input"
            style={{ margin: 0, flex: 1 }}
            placeholder="Search by display name..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
          />
          <button type="submit" disabled={nameSearchLoading || !nameSearch.trim()}>
            {nameSearchLoading ? "Searching..." : "Search"}
          </button>
        </form>

        {nameSearchResults.length > 0 && (
          <ul className="connection-list" style={{ marginBottom: "1.5rem" }}>
            {nameSearchResults.map((user) => (
              <li key={user.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                      }}
                    >
                      {user.display_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <strong>{user.display_name}</strong>
                </div>
                <button
                  type="button"
                  className="button-primary-accent btn-sm"
                  onClick={() => void handleSendInviteToId(user.id)}
                >
                  Connect
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleInvite} className="invite-form">
          <label>
            Or invite directly by User ID
            <input value={inviteId} onChange={(event) => setInviteId(event.target.value)} placeholder="UUID" />
          </label>
          <button type="submit">Send invite</button>
        </form>
      </section>

      {loading && <p className="page-status">Loading your network...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}

      {/* 2. Interactive Trust Graph */}
      <section className="network-graph-panel">
        <div className="section-heading">
          <div>
            <h2>Trusted graph</h2>
            <p>See direct friends and optionally one trusted hop beyond them.</p>
          </div>
          <label className="field-compact">
            Search depth
            <select value={graphDepth} onChange={(event) => setGraphDepth(Number(event.target.value) as 1 | 2)}>
              <option value={1}>Direct friends</option>
              <option value={2}>Friends of friends</option>
            </select>
          </label>
        </div>

        <NetworkGraph
          selfName={profile?.display_name ?? "You"}
          selfAvatarUrl={profile?.avatar_url}
          selfUserId={profile?.id}
          friends={graphFriends}
          edges={graphEdges}
          highlightedUserIds={new Set()}
          searchActive={false}
          onSelectNode={setSelectedGraphNode}
        />

        {selectedGraphNode && (
          <div className="graph-focus-panel" role="status">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {selectedGraphNode.avatar_url ? (
                <img
                  src={selectedGraphNode.avatar_url}
                  alt={selectedGraphNode.display_name}
                  style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : null}
              <div>
                <strong>{selectedGraphNode.display_name}</strong>
                <small>{selectedGraphNode.depth === 1 ? "Direct friend" : "Friend of friend"}</small>
              </div>
            </div>
            <span>
              {selectedGraphNode.card_count} visible card{selectedGraphNode.card_count === 1 ? "" : "s"}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="button-primary-accent btn-sm"
                onClick={() => void handleOpenPersonCards(selectedGraphNode)}
              >
                💳 View Cards
              </button>
              <button className="button-secondary btn-sm" type="button" onClick={() => setSelectedGraphNode(null)}>
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Direct Friends */}
      <section>
        <h2>Direct friends</h2>
        {!loading && friendships.length === 0 && <p className="empty-state">No direct friends yet.</p>}
        <ul className="connection-list">
          {friendships.map((friendship) => (
            <li key={`${friendship.user_a}-${friendship.user_b}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {friendship.counterpartyAvatarUrl ? (
                  <img
                    src={friendship.counterpartyAvatarUrl}
                    alt={friendship.counterpartyName}
                    style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#10b981",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {friendship.counterpartyName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="connection-person">
                  <strong>{friendship.counterpartyName}</strong>
                  <small>Direct friend</small>
                </div>
              </div>
              <div className="connection-actions">
                <button
                  type="button"
                  className="button-secondary btn-sm"
                  onClick={() =>
                    void handleOpenPersonCards({
                      user_id: friendship.counterpartyId,
                      display_name: friendship.counterpartyName,
                      depth: 1,
                      card_count: 0,
                      via_user_id: null,
                      avatar_url: friendship.counterpartyAvatarUrl,
                    })
                  }
                >
                  View Cards
                </button>
                <button className="button-danger" type="button" onClick={() => void handleBlock(friendship.counterpartyId)}>
                  Block
                </button>
                <button className="button-secondary" type="button" onClick={() => void handleRemoveFriend(friendship.counterpartyId)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Incoming requests */}
      <section>
        <h2>Incoming requests</h2>
        {!loading && incoming.length === 0 && <p className="empty-state">No incoming requests.</p>}
        <ul className="connection-list">
          {incoming.map((request) => (
            <li key={request.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {request.counterpartyAvatarUrl ? (
                  <img
                    src={request.counterpartyAvatarUrl}
                    alt={request.counterpartyName}
                    style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#f59e0b",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {request.counterpartyName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="connection-person">
                  <strong>{request.counterpartyName}</strong>
                  <small>Wants to connect</small>
                </div>
              </div>
              <div className="connection-actions">
                <button type="button" onClick={() => void handleAccept(request.id)}>
                  Accept
                </button>
                <button className="button-secondary" type="button" onClick={() => void handleDeclineOrCancel(request.id)}>
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Outgoing requests */}
      <section>
        <h2>Outgoing requests</h2>
        {!loading && outgoing.length === 0 && <p className="empty-state">No outgoing requests.</p>}
        <ul className="connection-list">
          {outgoing.map((request) => (
            <li key={request.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {request.counterpartyAvatarUrl ? (
                  <img
                    src={request.counterpartyAvatarUrl}
                    alt={request.counterpartyName}
                    style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : null}
                <div className="connection-person">
                  <strong>{request.counterpartyName}</strong>
                  <small>Invite pending</small>
                </div>
              </div>
              <button className="button-secondary" type="button" onClick={() => void handleDeclineOrCancel(request.id)}>
                Cancel invite
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 6. Blocked */}
      <section>
        <h2>Blocked</h2>
        {!loading && blocked.length === 0 && <p className="empty-state">No one is blocked.</p>}
        <ul className="connection-list">
          {blocked.map((block) => (
            <li key={block.blocked_id}>
              <div className="connection-person">
                <strong>{block.counterpartyName}</strong>
                <small>Blocked</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Person Cards Modal */}
      {modalPerson && (
        <PersonCardsModal
          isOpen={modalPerson !== null}
          onClose={() => setModalPerson(null)}
          person={modalPerson}
          cards={personCards}
          isLoading={personCardsLoading}
          error={personCardsError}
          onRetry={() => void handleOpenPersonCards(modalPerson)}
        />
      )}
    </div>
  );
}

export { MyNetworkPage };
