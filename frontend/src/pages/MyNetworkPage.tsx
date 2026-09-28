import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { resolveDisplayName, resolveUserProfile } from "../lib/resolveNames";
import { NetworkGraph } from "../components/NetworkGraph";
import type { GraphFriend } from "../components/NetworkGraph";
import { PersonCardsModal } from "../components/PersonCardsModal";
import { UserSearchInput } from "../components/UserSearchInput";
import { UserListItem } from "../components/UserListItem";
import type {
  BlockedUserSummary,
  FriendRequestSummary,
  FriendshipSummary,
  NetworkEdge,
  NetworkNode,
  UserCard,
  UserProfile,
} from "../types/api";

type EnrichedFriendship = FriendshipSummary & {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
  cardCount?: number;
};
type EnrichedRequest = FriendRequestSummary & {
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
  isFriendOfFriend?: boolean;
  mutualFriendName?: string | null;
};
type EnrichedBlock = BlockedUserSummary & {
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
};

type SearchUserResult = {
  id: string;
  display_name: string;
  status: string;
  relationship: "self" | "direct_friend" | "friend_of_friend" | "incoming_request" | "outgoing_request" | "blocked" | "none";
  mutualFriendName?: string | null;
  requestId?: string;
  avatar_url?: string | null;
};

export function MyNetworkPage() {
  const { profile } = useAuth();
  const [friendships, setFriendships] = useState<EnrichedFriendship[]>([]);
  const [incoming, setIncoming] = useState<EnrichedRequest[]>([]);
  const [outgoing, setOutgoing] = useState<EnrichedRequest[]>([]);
  const [blocked, setBlocked] = useState<EnrichedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Graph state
  const [graphDepth, setGraphDepth] = useState<1 | 2>(2);
  const [graphNodes, setGraphNodes] = useState<NetworkNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<NetworkEdge[]>([]);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphFriend | null>(null);

  // Selected Person Cards & Modal State
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [personCards, setPersonCards] = useState<UserCard[] | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [personProfile, setPersonProfile] = useState<UserProfile | null>(null);

  const fetchPersonCards = useCallback(async (userId: string) => {
    setCardsLoading(true);
    setCardsError(null);
    try {
      const [{ cards }, userProfileRes] = await Promise.all([
        api.getCards(userId),
        api.getUserProfile(userId).catch(() => ({ user: null as unknown as UserProfile })),
      ]);
      setPersonCards(cards || []);
      if (userProfileRes?.user) {
        setPersonProfile(userProfileRes.user);
      }
    } catch (err) {
      setCardsError(err instanceof Error ? err.message : "Something went wrong while loading cards.");
    } finally {
      setCardsLoading(false);
    }
  }, []);

  // Sync selected person cards loading
  useEffect(() => {
    if (selectedGraphNode) {
      setPersonCards(null);
      setPersonProfile(null);
      void fetchPersonCards(selectedGraphNode.user_id);
    } else {
      setPersonCards(null);
      setPersonProfile(null);
      setShowCardsModal(false);
    }
  }, [selectedGraphNode?.user_id, fetchPersonCards]);

  // Search by Name state
  const [searchNameQuery, setSearchNameQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingInviteToId, setSendingInviteToId] = useState<string | null>(null);

  // Fallback ID invite form
  const [showManualIdInput, setShowManualIdInput] = useState(false);
  const [manualInviteId, setManualInviteId] = useState("");

  // Tab view state
  const [activeTab, setActiveTab] = useState<"friends" | "incoming" | "outgoing" | "blocked">("friends");
  const [friendsFilterQuery, setFriendsFilterQuery] = useState("");

  const searchTimerRef = useRef<number | null>(null);

  // Load network connections
  async function loadNetwork(selfId: string) {
    setLoading(true);
    setError(null);

    try {
      const [{ friendships: allFriendships }, { requests: pending }, { blocks }, graphData] = await Promise.all([
        api.getFriendships(selfId),
        api.getPendingFriendRequests(selfId),
        api.getBlockedUsers(),
        api.getNetworkGraph(graphDepth, selfId),
      ]);

      const [friendshipsEnriched, incomingEnriched, outgoingEnriched, blockedEnriched] = await Promise.all([
        Promise.all(
          allFriendships.map(async (f) => {
            const counterpartyId = f.user_a === selfId ? f.user_b : f.user_a;
            const p = await resolveUserProfile(counterpartyId);
            return {
              ...f,
              counterpartyId,
              counterpartyName: p.display_name,
              counterpartyAvatarUrl: p.avatar_url,
            };
          }),
        ),
        Promise.all(
          pending
            .filter((r) => r.addressee_id === selfId)
            .map(async (r) => {
              const p = await resolveUserProfile(r.requester_id);
              return {
                ...r,
                counterpartyName: p.display_name,
                counterpartyAvatarUrl: p.avatar_url,
              };
            }),
        ),
        Promise.all(
          pending
            .filter((r) => r.requester_id === selfId)
            .map(async (r) => {
              const p = await resolveUserProfile(r.addressee_id);
              return {
                ...r,
                counterpartyName: p.display_name,
                counterpartyAvatarUrl: p.avatar_url,
              };
            }),
        ),
        Promise.all(
          blocks.map(async (b) => {
            const p = await resolveUserProfile(b.blocked_id);
            return {
              ...b,
              counterpartyName: p.display_name,
              counterpartyAvatarUrl: p.avatar_url,
            };
          }),
        ),
      ]);

      setFriendships(friendshipsEnriched);
      setIncoming(incomingEnriched);
      setOutgoing(outgoingEnriched);
      setBlocked(blockedEnriched);

      if (graphData && graphData.nodes) {
        setGraphNodes(graphData.nodes);
        setGraphEdges(graphData.edges || []);
      }
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

  // Load network graph
  useEffect(() => {
    if (!profile) return;

    api
      .getNetworkGraph(graphDepth, profile.id)
      .then(({ nodes, edges }) => {
        setGraphNodes(nodes || []);
        setGraphEdges(edges || []);
      })
      .catch(() => {
        // ignore
      });
  }, [graphDepth, profile, friendships]);

  // Search people by name with debounce
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const query = searchNameQuery.trim();
    if (!query || !profile) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const { users } = await api.searchUsers(query);

        // Map mutual friends lookup
        const directFriendIds = new Set(friendships.map((f) => f.counterpartyId));
        const directFriendMap = new Map(friendships.map((f) => [f.counterpartyId, f.counterpartyName]));
        const incomingMap = new Map(incoming.map((r) => [r.requester_id, r.id]));
        const outgoingMap = new Map(outgoing.map((r) => [r.addressee_id, r.id]));
        const blockedIds = new Set(blocked.map((b) => b.blocked_id));

        // Graph nodes for 2nd-degree detection
        const fofNodeMap = new Map(
          graphNodes
            .filter((n) => n.depth === 2)
            .map((n) => [n.user_id, n.via_user_id]),
        );

        const mapped: SearchUserResult[] = users
          .filter((u) => u.id !== profile.id)
          .map((u) => {
            // Backend computes real DB relationship and mutual friends
            let relationship: SearchUserResult["relationship"] = u.relationship as SearchUserResult["relationship"];
            let mutualFriendName = u.mutual_friend_name ?? null;
            let requestId = u.connection_id || undefined;

            // Fallback to local state if backend didn't supply relationship
            if (!relationship || relationship === "none") {
              if (directFriendIds.has(u.id)) {
                relationship = "direct_friend";
              } else if (incomingMap.has(u.id)) {
                relationship = "incoming_request";
                requestId = incomingMap.get(u.id);
              } else if (outgoingMap.has(u.id)) {
                relationship = "outgoing_request";
                requestId = outgoingMap.get(u.id);
              } else if (blockedIds.has(u.id)) {
                relationship = "blocked";
              } else if (fofNodeMap.has(u.id)) {
                relationship = "friend_of_friend";
                const viaId = fofNodeMap.get(u.id);
                if (viaId && directFriendMap.has(viaId)) {
                  mutualFriendName = directFriendMap.get(viaId) ?? null;
                }
              } else {
                relationship = "none";
              }
            } else if (relationship === "incoming_request" && !requestId) {
              requestId = incomingMap.get(u.id);
            } else if (relationship === "outgoing_request" && !requestId) {
              requestId = outgoingMap.get(u.id);
            }

            return {
              id: u.id,
              display_name: u.display_name,
              status: u.status,
              relationship,
              mutualFriendName,
              requestId,
              avatar_url: u.avatar_url ?? null,
            };
          });

        setSearchResults(mapped);
        setHasSearched(true);
      } catch {
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchNameQuery, profile, friendships, incoming, outgoing, blocked, graphNodes]);

  // Actions
  async function handleSendInvite(targetUserId: string, targetName?: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setSendingInviteToId(targetUserId);

    try {
      await api.sendFriendRequest(targetUserId);
      setSuccess(`Connection invite sent to ${targetName || "user"}!`);
      setManualInviteId("");
      await loadNetwork(profile.id);
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : "Failed to send invite");
    } finally {
      setSendingInviteToId(null);
    }
  }

  async function handleManualInvite(event: FormEvent) {
    event.preventDefault();
    if (!profile || !manualInviteId.trim()) return;
    await handleSendInvite(manualInviteId.trim(), "user");
  }

  async function handleAccept(requestId: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);

    try {
      await api.acceptFriendRequest(requestId);
      setSuccess("Connection accepted! They are now in your direct network.");
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to accept connection");
    }
  }

  async function handleDeclineOrCancel(requestId: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);

    try {
      await api.declineFriendRequest(requestId);
      setSuccess("Request updated.");
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to update request");
    }
  }

  async function handleRemoveFriend(friendId: string, friendName: string) {
    if (!profile) return;
    if (!window.confirm(`Are you sure you want to remove ${friendName} from your trusted friends?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.removeFriend(friendId);
      setSuccess(`Removed ${friendName} from direct friends.`);
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to remove connection");
    }
  }

  async function handleBlock(targetId: string, targetName: string) {
    if (!profile) return;
    if (
      !window.confirm(
        `Block ${targetName}? This removes connection and prevents future requests between you.`,
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.blockUser(targetId);
      setSuccess(`Blocked ${targetName}.`);
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to block user");
    }
  }

  async function handleUnblock(targetId: string, targetName: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);

    try {
      await api.unblockUser(targetId);
      setSuccess(`Unblocked ${targetName}.`);
      await loadNetwork(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to unblock user");
    }
  }

  const graphFriends = useMemo(
    () => graphNodes.filter((node) => node.depth > 0) as GraphFriend[],
    [graphNodes],
  );

  const secondDegreeCount = useMemo(
    () => graphNodes.filter((node) => node.depth === 2).length,
    [graphNodes],
  );

  // Filter direct friends
  const filteredFriends = useMemo(() => {
    if (!friendsFilterQuery.trim()) return friendships;
    const q = friendsFilterQuery.toLowerCase().trim();
    return friendships.filter((f) => f.counterpartyName.toLowerCase().includes(q));
  }, [friendships, friendsFilterQuery]);

  const displayedCardCount =
    personCards !== null
      ? personCards.length
      : selectedGraphNode?.card_count ?? 0;

  return (
    <div className="page">
      <div className="page-heading-row">
        <div>
          <h1>My Network</h1>
          <p className="page-intro">
            Connect with friends, discover your extended friends-of-friends trust graph, and manage requests.
          </p>
        </div>
      </div>

      {/* Global Status Toasts */}
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

      {/* Overview Stat Pills */}
      <div className="network-stats-row">
        <div className="network-stat-pill">
          <span className="stat-pill-icon">👥</span>
          <div className="stat-pill-data">
            <span className="stat-pill-num">{friendships.length}</span>
            <span className="stat-pill-label">Direct Friends</span>
          </div>
        </div>
        <div className="network-stat-pill">
          <span className="stat-pill-icon">🌱</span>
          <div className="stat-pill-data">
            <span className="stat-pill-num">{secondDegreeCount}</span>
            <span className="stat-pill-label">Friends of Friends</span>
          </div>
        </div>
        <div className="network-stat-pill">
          <span className="stat-pill-icon">📥</span>
          <div className="stat-pill-data">
            <span className="stat-pill-num">{incoming.length}</span>
            <span className="stat-pill-label">Incoming Requests</span>
          </div>
        </div>
        <div className="network-stat-pill">
          <span className="stat-pill-icon">📤</span>
          <div className="stat-pill-data">
            <span className="stat-pill-num">{outgoing.length}</span>
            <span className="stat-pill-label">Pending Sent</span>
          </div>
        </div>
      </div>

      {/* 1. Search by Name to Connect */}
      <section className="network-search-card">
        <div className="network-search-heading">
          <div>
            <h2>Find & Connect by Name</h2>
            <small>
              Search for any friend by their name. If they are already a friend-of-a-friend, we'll highlight your mutual path!
            </small>
          </div>
          <button
            type="button"
            className="link-button"
            style={{ width: "auto", margin: 0, fontSize: "0.82rem" }}
            onClick={() => setShowManualIdInput(!showManualIdInput)}
          >
            {showManualIdInput ? "Hide User ID input" : "Have a User ID instead?"}
          </button>
        </div>

        <UserSearchInput
          value={searchNameQuery}
          onChange={setSearchNameQuery}
          onClear={() => setSearchResults([])}
          isSearching={isSearching}
          placeholder="Type a friend's name (e.g. René, Sarah, Arjun)..."
        />

        {/* Fallback User ID Invite Drawer */}
        {showManualIdInput && (
          <form onSubmit={handleManualInvite} className="invite-form" style={{ marginTop: "1rem" }}>
            <label>
              Invite by exact User ID
              <input
                value={manualInviteId}
                onChange={(event) => setManualInviteId(event.target.value)}
                placeholder="Paste Supabase user ID (UUID)..."
                required
              />
            </label>
            <button type="submit" disabled={sendingInviteToId !== null}>
              {sendingInviteToId ? "Sending..." : "Send invite"}
            </button>
          </form>
        )}

        {/* Search Results Display */}
        {hasSearched && !isSearching && searchResults.length === 0 && (
          <p className="empty-state" style={{ marginTop: "1rem" }}>
            No users found matching &ldquo;<strong>{searchNameQuery}</strong>&rdquo;. Try another name or share your user ID.
          </p>
        )}

        {searchResults.length > 0 && (
          <ul className="search-results-list">
            {searchResults.map((user) => (
              <UserListItem
                key={user.id}
                user={{
                  id: user.id,
                  display_name: user.display_name,
                  relationship: user.relationship,
                  mutualFriendName: user.mutualFriendName,
                  requestId: user.requestId,
                  avatar_url: user.avatar_url,
                }}
                onSendInvite={handleSendInvite}
                onAcceptRequest={handleAccept}
                onDeclineRequest={handleDeclineOrCancel}
                onCancelRequest={handleDeclineOrCancel}
                onBlock={handleBlock}
                showBlockOption
                isBusy={sendingInviteToId === user.id}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 2. Interactive Constellation Graph (Model from Reference Image) */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div>
            <span className="eyebrow">Visual Trust Map</span>
            <h2 style={{ margin: "4px 0" }}>Interactive Constellation</h2>
          </div>

          <label className="field-compact" style={{ flexDirection: "row", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--ink-600)" }}>Graph depth:</span>
            <select
              value={graphDepth}
              onChange={(event) => setGraphDepth(Number(event.target.value) as 1 | 2)}
              style={{ minHeight: "38px" }}
            >
              <option value={1}>Direct friends only</option>
              <option value={2}>Full network (Friends of friends)</option>
            </select>
          </label>
        </div>

        <NetworkGraph
          selfName={profile?.display_name ?? "You"}
          selfAvatarUrl={profile?.avatar_url}
          friends={graphFriends}
          edges={graphEdges}
          selfUserId={profile?.id}
          highlightedUserIds={new Set()}
          searchActive={false}
          onSelectNode={setSelectedGraphNode}
        />

        {selectedGraphNode && (
          <div
            className="person-details-panel"
            role="region"
            aria-label={`Details for ${selectedGraphNode.display_name}`}
          >
            <div className="person-details-left">
              <div
                className="person-details-avatar"
                style={{
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {selectedGraphNode.avatar_url ? (
                  <img
                    src={selectedGraphNode.avatar_url}
                    alt={selectedGraphNode.display_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  selectedGraphNode.display_name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="person-details-info">
                <div className="person-details-header-row">
                  <h3 className="person-details-name">{selectedGraphNode.display_name}</h3>
                  <span className="person-details-depth-tag">
                    {selectedGraphNode.depth === 1
                      ? "✓ Direct Trusted Friend"
                      : selectedGraphNode.depth === 2
                      ? "✨ Friend of Friend"
                      : "You"}
                  </span>
                </div>
                <div className="person-details-counter">
                  {cardsLoading && personCards === null ? (
                    <span className="person-details-loading-pill">Counting cards...</span>
                  ) : (
                    <span className="person-details-card-count">
                      💳 {displayedCardCount} {displayedCardCount === 1 ? "Card" : "Cards"} Shared
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="person-details-actions">
              <button
                type="button"
                className="btn-view-cards"
                onClick={() => setShowCardsModal(true)}
                title={`View all cards shared by ${selectedGraphNode.display_name}`}
                aria-label={`View cards shared by ${selectedGraphNode.display_name}`}
              >
                <span className="btn-card-icon" aria-hidden="true">💳</span>
                <span>View Cards</span>
                <span className="btn-count-chip">{displayedCardCount}</span>
              </button>
              <button
                className="button-secondary btn-sm"
                type="button"
                onClick={() => {
                  setSelectedGraphNode(null);
                  setShowCardsModal(false);
                }}
                title="Deselect person"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <PersonCardsModal
          isOpen={showCardsModal}
          onClose={() => setShowCardsModal(false)}
          person={selectedGraphNode}
          cards={personCards}
          isLoading={cardsLoading}
          error={cardsError}
          onRetry={() => {
            if (selectedGraphNode) {
              void fetchPersonCards(selectedGraphNode.user_id);
            }
          }}
          personProfile={personProfile}
        />
      </section>

      {/* 3. Segmented Navigation Tabs for Network Lists */}
      <div className="network-segmented-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "friends"}
          className={`network-tab-button ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          <span>👥 Direct Friends</span>
          <span className="tab-badge">{friendships.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "incoming"}
          className={`network-tab-button ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          <span>📥 Incoming Requests</span>
          <span className={`tab-badge ${incoming.length > 0 ? "badge-alert" : ""}`}>
            {incoming.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "outgoing"}
          className={`network-tab-button ${activeTab === "outgoing" ? "active" : ""}`}
          onClick={() => setActiveTab("outgoing")}
        >
          <span>📤 Outgoing Requests</span>
          <span className="tab-badge">{outgoing.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "blocked"}
          className={`network-tab-button ${activeTab === "blocked" ? "active" : ""}`}
          onClick={() => setActiveTab("blocked")}
        >
          <span>🛡️ Blocked</span>
          <span className="tab-badge">{blocked.length}</span>
        </button>
      </div>

      {/* Tab 1: Direct Friends */}
      {activeTab === "friends" && (
        <section>
          <div className="friends-filter-bar">
            <div>
              <h2>Direct Friends ({friendships.length})</h2>
              <small>People who directly trust you and share card access.</small>
            </div>
            {friendships.length > 0 && (
              <input
                className="friends-search-input"
                type="search"
                placeholder="Filter direct friends..."
                value={friendsFilterQuery}
                onChange={(e) => setFriendsFilterQuery(e.target.value)}
              />
            )}
          </div>

          {!loading && friendships.length === 0 && (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👥</div>
              <h3>No direct friends yet</h3>
              <p style={{ maxWidth: "36ch", margin: "0 auto 1.5rem", color: "var(--ink-600)" }}>
                Start by searching for a friend's name above or sharing your personal user ID with them.
              </p>
              <button
                type="button"
                className="button-primary-accent"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Search People to Connect
              </button>
            </div>
          )}

          {filteredFriends.length > 0 && (
            <ul className="friend-cards-grid">
              {filteredFriends.map((friendship) => (
                <li key={`${friendship.user_a}-${friendship.user_b}`} className="friend-card">
                  <div className="friend-card-top">
                    <div
                      className="friend-avatar"
                      style={{
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      {friendship.counterpartyAvatarUrl ? (
                        <img
                          src={friendship.counterpartyAvatarUrl}
                          alt={friendship.counterpartyName}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        friendship.counterpartyName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="friend-card-details">
                      <strong>{friendship.counterpartyName}</strong>
                      <small>✓ Direct Trusted Connection</small>
                    </div>
                  </div>

                  <div className="friend-card-meta">
                    <span>Added {new Date(friendship.created_at).toLocaleDateString()}</span>
                    <span style={{ color: "#0f766e", fontWeight: 600 }}>Active</span>
                  </div>

                  <div className="friend-card-actions">
                    <button
                      className="button-primary-accent btn-sm"
                      type="button"
                      title={`View cards shared by ${friendship.counterpartyName}`}
                      onClick={() => {
                        setSelectedGraphNode({
                          user_id: friendship.counterpartyId,
                          display_name: friendship.counterpartyName,
                          depth: 1,
                          card_count: 0,
                          via_user_id: null,
                          avatar_url: friendship.counterpartyAvatarUrl || null,
                        });
                        setShowCardsModal(true);
                      }}
                    >
                      💳 View Cards
                    </button>
                    <button
                      className="button-secondary btn-sm"
                      type="button"
                      title="Remove from friends"
                      onClick={() =>
                        void handleRemoveFriend(
                          friendship.counterpartyId,
                          friendship.counterpartyName,
                        )
                      }
                    >
                      Remove
                    </button>
                    <button
                      className="button-danger btn-sm"
                      type="button"
                      title="Block user"
                      onClick={() =>
                        void handleBlock(
                          friendship.counterpartyId,
                          friendship.counterpartyName,
                        )
                      }
                    >
                      Block
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {friendships.length > 0 && filteredFriends.length === 0 && (
            <p className="empty-state">No friends matching "{friendsFilterQuery}".</p>
          )}
        </section>
      )}

      {/* Tab 2: Incoming Requests */}
      {activeTab === "incoming" && (
        <section>
          <h2>Incoming Requests ({incoming.length})</h2>
          <p className="page-intro" style={{ marginBottom: "1rem" }}>
            People who want to add you to their trusted resource network.
          </p>

          {!loading && incoming.length === 0 && (
            <div className="empty-state" style={{ textAlign: "center", padding: "2rem" }}>
              <p>No incoming friend requests at the moment.</p>
            </div>
          )}

          <ul className="request-card-list">
            {incoming.map((request) => (
              <li key={request.id} className="request-card-item request-card-incoming">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    className="person-avatar"
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {request.counterpartyAvatarUrl ? (
                      <img
                        src={request.counterpartyAvatarUrl}
                        alt={request.counterpartyName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      request.counterpartyName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{request.counterpartyName}</strong>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink-600)" }}>
                      Sent you a friend request · {new Date(request.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="button-primary-accent btn-sm"
                    onClick={() => void handleAccept(request.id)}
                  >
                    ✓ Accept
                  </button>
                  <button
                    className="button-secondary btn-sm"
                    type="button"
                    onClick={() => void handleDeclineOrCancel(request.id)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tab 3: Outgoing Requests */}
      {activeTab === "outgoing" && (
        <section>
          <h2>Outgoing Requests ({outgoing.length})</h2>
          <p className="page-intro" style={{ marginBottom: "1rem" }}>
            Invites you have sent that are awaiting response.
          </p>

          {!loading && outgoing.length === 0 && (
            <div className="empty-state" style={{ textAlign: "center", padding: "2rem" }}>
              <p>No pending outgoing requests.</p>
            </div>
          )}

          <ul className="request-card-list">
            {outgoing.map((request) => (
              <li key={request.id} className="request-card-item request-card-outgoing">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    className="person-avatar"
                    style={{
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {request.counterpartyAvatarUrl ? (
                      <img
                        src={request.counterpartyAvatarUrl}
                        alt={request.counterpartyName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      request.counterpartyName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{request.counterpartyName}</strong>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink-600)" }}>
                      Invite sent on {new Date(request.created_at).toLocaleDateString()} · Pending approval
                    </div>
                  </div>
                </div>

                <button
                  className="button-secondary btn-sm"
                  type="button"
                  onClick={() => void handleDeclineOrCancel(request.id)}
                >
                  Cancel Invite
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tab 4: Blocked Users */}
      {activeTab === "blocked" && (
        <section>
          <h2>Blocked Users ({blocked.length})</h2>
          <p className="page-intro" style={{ marginBottom: "1rem" }}>
            Blocked users cannot see your cards, find you in network search, or send requests.
          </p>

          {!loading && blocked.length === 0 && (
            <div className="empty-state" style={{ textAlign: "center", padding: "2rem" }}>
              <p>No one is currently blocked.</p>
            </div>
          )}

          <ul className="request-card-list">
            {blocked.map((block) => (
              <li key={block.blocked_id} className="request-card-item request-card-blocked">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    className="person-avatar"
                    style={{
                      background: "#64748b",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {block.counterpartyAvatarUrl ? (
                      <img
                        src={block.counterpartyAvatarUrl}
                        alt={block.counterpartyName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      block.counterpartyName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{block.counterpartyName}</strong>
                    <div style={{ fontSize: "0.82rem", color: "#b91c1c" }}>
                      Blocked on {new Date(block.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button
                  className="button-secondary btn-sm"
                  type="button"
                  onClick={() => void handleUnblock(block.blocked_id, block.counterpartyName)}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
