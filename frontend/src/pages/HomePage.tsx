import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/apiClient";
import { resolveDisplayName, resolveUserProfile } from "../lib/resolveNames";
import { NetworkGraph } from "../components/NetworkGraph";
import type { GraphFriend } from "../components/NetworkGraph";
import { UserListItem } from "../components/UserListItem";
import type {
  FriendOfFriendSummary,
  FriendRequestSummary,
  NetworkEdge,
  NetworkNode,
  NetworkStats,
  SearchUserSummary,
  UserCard,
} from "../types/api";

type SearchFilterType = "all" | "friends" | "fof" | "requests";

interface EnrichedIncomingRequest extends FriendRequestSummary {
  requesterName: string;
  requesterAvatarUrl?: string | null;
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  let timeOfDay = "Good morning";
  if (hour >= 12 && hour < 17) {
    timeOfDay = "Good afternoon";
  } else if (hour >= 17) {
    timeOfDay = "Good evening";
  }
  const cleanName = name ? name.split(" ")[0] : "";
  return cleanName ? `${timeOfDay}, ${cleanName} 👋` : `${timeOfDay} 👋`;
}

function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Core State
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // 2. Saved Cards (Strict: Name and Type ONLY)
  const [cards, setCards] = useState<UserCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  // 3. Network Graph
  const [graphDepth, setGraphDepth] = useState<1 | 2>(2);
  const [graphFriends, setGraphFriends] = useState<GraphFriend[]>([]);
  const [graphEdges, setGraphEdges] = useState<NetworkEdge[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);

  // 4. Discovery / People You May Know (FoF)
  const [fofSuggestions, setFofSuggestions] = useState<FriendOfFriendSummary[]>([]);
  const [fofLoading, setFofLoading] = useState(true);

  // 5. Incoming Requests Preview
  const [incomingRequests, setIncomingRequests] = useState<EnrichedIncomingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // 6. Central Search Experience
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>("all");
  const [searchResults, setSearchResults] = useState<SearchUserSummary[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 7. Interactive Feedback & Busy States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-clear feedback toast
  useEffect(() => {
    if (feedback) {
      const timer = window.setTimeout(() => setFeedback(null), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [feedback]);

  // Load Dashboard Data
  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;

    // Load Network Stats
    api
      .getNetworkStats(userId)
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));

    // Load User Saved Cards
    api
      .getCards(userId)
      .then(({ cards: userCards }) => setCards(userCards))
      .catch(() => {})
      .finally(() => setCardsLoading(false));

    // Load Friends of Friends (People You May Know)
    api
      .getFriendsOfFriends(userId)
      .then(({ friendsOfFriends }) => setFofSuggestions(friendsOfFriends))
      .catch(() => {})
      .finally(() => setFofLoading(false));

    // Load Pending Incoming Requests
    api
      .getPendingFriendRequests(userId)
      .then(async ({ requests }) => {
        const incoming = requests.filter((r) => r.addressee_id === userId);
        const enriched: EnrichedIncomingRequest[] = await Promise.all(
          incoming.map(async (req) => {
            const p = await resolveUserProfile(req.requester_id);
            return {
              ...req,
              requesterName: p.display_name,
              requesterAvatarUrl: p.avatar_url,
            };
          }),
        );
        setIncomingRequests(enriched);
      })
      .catch(() => {})
      .finally(() => setRequestsLoading(false));
  }, [profile]);

  // Load / Update Network Graph when depth or profile changes
  useEffect(() => {
    if (!profile) return;
    setGraphLoading(true);

    api
      .getNetworkGraph(graphDepth, profile.id)
      .then(({ nodes, edges }) => {
        // Filter out self node for the friends array
        const otherNodes = nodes.filter((n: NetworkNode) => n.depth > 0) as GraphFriend[];
        setGraphFriends(otherNodes);
        setGraphEdges(edges || []);
      })
      .catch(() => {
        setGraphFriends([]);
        setGraphEdges([]);
      })
      .finally(() => setGraphLoading(false));
  }, [profile, graphDepth]);

  // Debounced Real Search Trigger
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const debounceTimer = window.setTimeout(async () => {
      try {
        const { users } = await api.searchUsers(trimmed, searchFilter);
        setSearchResults(users);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(debounceTimer);
  }, [searchQuery, searchFilter]);

  // Actions: Send Invite
  async function handleSendInvite(targetUserId: string, targetName: string) {
    if (!profile) return;
    setActionLoadingId(targetUserId);

    try {
      const { connection } = await api.sendFriendRequest(targetUserId);

      // Update Search Results locally
      setSearchResults((prev) =>
        prev
          ? prev.map((u) =>
              u.id === targetUserId
                ? { ...u, relationship: "outgoing_request", connection_id: connection.id }
                : u,
            )
          : null,
      );

      // Remove from FoF suggestions
      setFofSuggestions((prev) => prev.filter((p) => p.id !== targetUserId));

      setFeedback({ type: "success", message: `Connection invitation sent to ${targetName}!` });

      // Refresh Stats
      api.getNetworkStats(profile.id).then(setStats).catch(() => {});
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to send invitation.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // Actions: Accept Incoming Request
  async function handleAcceptRequest(connectionId: string, requesterName?: string) {
    if (!profile) return;
    setActionLoadingId(connectionId);

    try {
      await api.acceptFriendRequest(connectionId);

      // Remove from incoming requests list
      setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId));

      // Update Search Results
      setSearchResults((prev) =>
        prev
          ? prev.map((u) =>
              u.connection_id === connectionId
                ? { ...u, relationship: "direct_friend" }
                : u,
            )
          : null,
      );

      setFeedback({
        type: "success",
        message: requesterName ? `You are now connected with ${requesterName}!` : "Connection accepted!",
      });

      // Refresh Stats and Graph
      api.getNetworkStats(profile.id).then(setStats).catch(() => {});
      api.getNetworkGraph(graphDepth, profile.id).then(({ nodes, edges }) => {
        setGraphFriends(nodes.filter((n) => n.depth > 0) as GraphFriend[]);
        setGraphEdges(edges || []);
      }).catch(() => {});
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to accept connection.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // Actions: Decline Request
  async function handleDeclineRequest(connectionId: string) {
    if (!profile) return;
    setActionLoadingId(connectionId);

    try {
      await api.declineFriendRequest(connectionId);

      setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId));
      setSearchResults((prev) =>
        prev
          ? prev.map((u) =>
              u.connection_id === connectionId
                ? { ...u, relationship: "none", connection_id: null }
                : u,
            )
          : null,
      );

      setFeedback({ type: "success", message: "Request declined." });
      api.getNetworkStats(profile.id).then(setStats).catch(() => {});
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to decline request.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // Actions: Cancel Outgoing Request
  async function handleCancelRequest(connectionId: string) {
    if (!profile) return;
    setActionLoadingId(connectionId);

    try {
      await api.declineFriendRequest(connectionId);

      setSearchResults((prev) =>
        prev
          ? prev.map((u) =>
              u.connection_id === connectionId
                ? { ...u, relationship: "none", connection_id: null }
                : u,
            )
          : null,
      );

      setFeedback({ type: "success", message: "Invitation cancelled." });
      api.getNetworkStats(profile.id).then(setStats).catch(() => {});
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel invitation.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // Focus Search Bar
  function handleFocusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="home-command-page">
      {/* Toast Alert Feedback */}
      {feedback && (
        <div
          className={`home-toast-alert ${feedback.type === "success" ? "toast-success" : "toast-error"}`}
          role="status"
        >
          <span>{feedback.type === "success" ? "✓" : "⚠️"}</span>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* 1. Header & Personalized Welcome Banner */}
      <section className="home-welcome-banner">
        <div className="welcome-text-group">
          <div className="welcome-eyebrow">
            <span className="live-status-dot" />
            <span>Network Command Center</span>
          </div>
          <h1 className="welcome-headline">{getGreeting(profile?.display_name)}</h1>
          <p className="welcome-subline">
            Discover trusted peers, visualize your community reach, and share card resources securely.
          </p>
        </div>

        <div className="welcome-quick-shortcuts">
          <button
            type="button"
            className="home-shortcut-btn shortcut-primary"
            onClick={handleFocusSearch}
          >
            <span>🔍</span> Find Connections
          </button>
          <Link to="/network" className="home-shortcut-btn">
            <span>👥</span> My Network
          </Link>
          <Link to="/cards" className="home-shortcut-btn">
            <span>💳</span> My Cards
          </Link>
        </div>
      </section>

      {/* 2. Live Network Snapshot Metrics */}
      <section className="home-stats-bar" aria-label="Network Snapshot">
        <Link to="/network" className="home-stat-tile" title="View Direct Connections">
          <div className="stat-tile-header">
            <span className="stat-tile-icon icon-friends">👥</span>
            <span className="stat-tile-trend">1st Degree</span>
          </div>
          <div className="stat-tile-value">
            {statsLoading ? <span className="skeleton-num" /> : stats?.directFriends ?? 0}
          </div>
          <div className="stat-tile-label">Direct Friends</div>
          <div className="stat-tile-sub">Trusted connections in your circle</div>
        </Link>

        <Link to="/network" className="home-stat-tile" title="View Extended Network">
          <div className="stat-tile-header">
            <span className="stat-tile-icon icon-reach">🌱</span>
            <span className="stat-tile-trend">Extended Circle</span>
          </div>
          <div className="stat-tile-value">
            {statsLoading ? <span className="skeleton-num" /> : stats?.friendsOfFriends ?? 0}
          </div>
          <div className="stat-tile-label">Network Reach</div>
          <div className="stat-tile-sub">Friends of friends across 2 hops</div>
        </Link>

        <Link to="/requests" className="home-stat-tile" title="Manage Pending Requests">
          <div className="stat-tile-header">
            <span className="stat-tile-icon icon-requests">📬</span>
            {(stats?.incomingRequests ?? 0) > 0 && (
              <span className="stat-tile-badge">{stats?.incomingRequests} new</span>
            )}
          </div>
          <div className="stat-tile-value">
            {statsLoading ? <span className="skeleton-num" /> : stats?.totalRequests ?? 0}
          </div>
          <div className="stat-tile-label">Pending Requests</div>
          <div className="stat-tile-sub">
            {stats?.incomingRequests ?? 0} incoming · {stats?.pendingRequests ?? 0} sent
          </div>
        </Link>

        <Link to="/cards" className="home-stat-tile" title="Manage Saved Cards">
          <div className="stat-tile-header">
            <span className="stat-tile-icon icon-cards">💳</span>
            <span className="stat-tile-trend">Catalog Records</span>
          </div>
          <div className="stat-tile-value">
            {cardsLoading ? <span className="skeleton-num" /> : cards.length}
          </div>
          <div className="stat-tile-label">My Saved Cards</div>
          <div className="stat-tile-sub">Card name & type selections</div>
        </Link>
      </section>

      {/* 3. Hero Search & Discovery Experience */}
      <section className="home-discovery-card" aria-label="Search and Discovery">
        <div className="discovery-header">
          <div>
            <h2 className="discovery-title">Intelligent Network Search</h2>
            <p className="discovery-desc">
              Search by name, username, or relationship to connect with peers and discover mutual circles.
            </p>
          </div>
        </div>

        {/* Central Search Input */}
        <div className="discovery-input-wrapper">
          <span className="search-lead-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="search"
            className="discovery-search-field"
            placeholder="Search people by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search users in your network"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="discovery-filter-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={searchFilter === "all"}
            className={`filter-tab ${searchFilter === "all" ? "tab-active" : ""}`}
            onClick={() => setSearchFilter("all")}
          >
            <span>🌐</span> All People
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={searchFilter === "friends"}
            className={`filter-tab ${searchFilter === "friends" ? "tab-active" : ""}`}
            onClick={() => setSearchFilter("friends")}
          >
            <span>👥</span> Direct Friends
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={searchFilter === "fof"}
            className={`filter-tab ${searchFilter === "fof" ? "tab-active" : ""}`}
            onClick={() => setSearchFilter("fof")}
          >
            <span>🌱</span> Friends of Friends
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={searchFilter === "requests"}
            className={`filter-tab ${searchFilter === "requests" ? "tab-active" : ""}`}
            onClick={() => setSearchFilter("requests")}
          >
            <span>📬</span> Requests
          </button>
        </div>

        {/* Search Results Area */}
        {isSearching && (
          <div className="search-loading-bar" role="status">
            <span className="spinner-dots" />
            <span>Searching your trusted network...</span>
          </div>
        )}

        {searchError && (
          <div className="search-error-banner" role="alert">
            <span>⚠️ {searchError}</span>
          </div>
        )}

        {/* Active Search Results List */}
        {searchResults !== null && !isSearching && (
          <div className="discovery-results-panel">
            <div className="results-counter-row">
              <span className="results-count">
                Found <strong>{searchResults.length}</strong> result
                {searchResults.length === 1 ? "" : "s"} for "{searchQuery}"
              </span>
              <button
                type="button"
                className="close-results-link"
                onClick={() => setSearchQuery("")}
              >
                Close search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="search-empty-state">
                <span className="empty-search-icon">🔍</span>
                <h3>No connections found</h3>
                <p>
                  No users matched "{searchQuery}" under the selected filter. Try searching with a different name or switch to "All People".
                </p>
              </div>
            ) : (
              <div className="search-results-list">
                {searchResults.map((user) => (
                  <UserListItem
                    key={user.id}
                    user={{
                      id: user.id,
                      display_name: user.display_name,
                      email: user.email,
                      relationship: user.relationship,
                      mutualFriendName: user.mutual_friend_name,
                      mutualFriendCount: user.mutual_friend_count,
                      requestId: user.connection_id ?? undefined,
                      avatar_url: user.avatar_url,
                    }}
                    onSendInvite={(id, name) => void handleSendInvite(id, name)}
                    onAcceptRequest={(reqId) => void handleAcceptRequest(reqId, user.display_name)}
                    onDeclineRequest={(reqId) => void handleDeclineRequest(reqId)}
                    onCancelRequest={(reqId) => void handleCancelRequest(reqId)}
                    isBusy={actionLoadingId === user.id || actionLoadingId === user.connection_id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State / Suggestions when not searching */}
        {searchResults === null && !searchQuery.trim() && (
          <div className="discovery-hint-row">
            <span className="hint-label">💡 Suggestions:</span>
            <button
              type="button"
              className="hint-tag"
              onClick={() => {
                setSearchQuery("a");
                searchInputRef.current?.focus();
              }}
            >
              Browse community
            </button>
            <Link to="/network" className="hint-tag">
              Explore your network map
            </Link>
            <Link to="/requests" className="hint-tag">
              Check incoming invitations
            </Link>
          </div>
        )}
      </section>

      {/* 4. Central Split Grid: Visualization (Left) + Activity Previews (Right) */}
      <div className="home-command-grid">
        {/* Left Column: Interactive Network Constellation Graph */}
        <section className="grid-graph-column">
          <div className="graph-frame-card">
            {/* Depth Selector Header Bar */}
            <div className="graph-frame-header">
              <div className="graph-frame-title">
                <span className="frame-icon">🌌</span>
                <div>
                  <h3>Interactive Trust Constellation</h3>
                  <p>Visualize direct friends and 2nd-degree paths in real-time</p>
                </div>
              </div>

              {/* Depth Toggle Buttons */}
              <div className="depth-segmented-toggle" role="group" aria-label="Graph Depth Controls">
                <button
                  type="button"
                  className={`depth-toggle-btn ${graphDepth === 1 ? "depth-active" : ""}`}
                  onClick={() => setGraphDepth(1)}
                  title="Show only direct 1st-degree friends"
                >
                  Direct (Depth 1)
                </button>
                <button
                  type="button"
                  className={`depth-toggle-btn ${graphDepth === 2 ? "depth-active" : ""}`}
                  onClick={() => setGraphDepth(2)}
                  title="Show direct friends and friends of friends"
                >
                  Full Network (Depth 2)
                </button>
              </div>
            </div>

            {/* Embedded Live Graph */}
            {graphLoading ? (
              <div className="graph-loading-placeholder">
                <span className="spinner-dots" />
                <p>Computing live network constellation physics...</p>
              </div>
            ) : (
              <NetworkGraph
                selfName={profile?.display_name ?? "You"}
                selfAvatarUrl={profile?.avatar_url}
                friends={graphFriends}
                edges={graphEdges}
                selfUserId={profile?.id ?? "self"}
              />
            )}
          </div>
        </section>

        {/* Right Column: Previews & Discovery Hub */}
        <aside className="grid-hub-column">
          {/* Actionable Connection Requests Preview */}
          <div className="hub-card">
            <div className="hub-card-header">
              <div className="hub-header-title">
                <span className="hub-icon">📬</span>
                <h4>Connection Requests</h4>
              </div>
              <Link to="/requests" className="hub-view-all">
                View all ({incomingRequests.length}) →
              </Link>
            </div>

            <div className="hub-card-body">
              {requestsLoading ? (
                <div className="hub-loading">Loading requests...</div>
              ) : incomingRequests.length === 0 ? (
                <div className="hub-empty-state">
                  <span className="hub-empty-icon">✨</span>
                  <p>All caught up! No incoming connection requests waiting.</p>
                  <Link to="/requests" className="hub-inline-link">
                    View outgoing requests
                  </Link>
                </div>
              ) : (
                <div className="hub-request-list">
                  {incomingRequests.slice(0, 3).map((req) => (
                    <div key={req.id} className="hub-request-item">
                      <div
                        className="hub-request-avatar"
                        style={{
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        {req.requesterAvatarUrl ? (
                          <img
                            src={req.requesterAvatarUrl}
                            alt={req.requesterName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          req.requesterName.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="hub-request-info">
                        <strong>{req.requesterName}</strong>
                        <span className="hub-request-time">
                          Sent {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="hub-request-actions">
                        <button
                          type="button"
                          className="btn-action-accept"
                          onClick={() => void handleAcceptRequest(req.id, req.requesterName)}
                          disabled={actionLoadingId === req.id}
                          title="Accept friend request"
                        >
                          {actionLoadingId === req.id ? "..." : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="btn-action-decline"
                          onClick={() => void handleDeclineRequest(req.id)}
                          disabled={actionLoadingId === req.id}
                          title="Decline request"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* People You May Know (Extended Network Discovery) */}
          <div className="hub-card">
            <div className="hub-card-header">
              <div className="hub-header-title">
                <span className="hub-icon">🌱</span>
                <h4>People You May Know</h4>
              </div>
              <Link to="/network" className="hub-view-all">
                Explore circle →
              </Link>
            </div>

            <div className="hub-card-body">
              {fofLoading ? (
                <div className="hub-loading">Finding potential connections...</div>
              ) : fofSuggestions.length === 0 ? (
                <div className="hub-empty-state">
                  <span className="hub-empty-icon">👥</span>
                  <p>
                    Connect with direct friends to discover friends of friends in your network.
                  </p>
                  <button
                    type="button"
                    className="hub-inline-btn"
                    onClick={handleFocusSearch}
                  >
                    Search people
                  </button>
                </div>
              ) : (
                <div className="hub-fof-list">
                  {fofSuggestions.slice(0, 4).map((person) => (
                    <div key={person.id} className="hub-fof-item">
                      <div
                        className="hub-fof-avatar"
                        style={{
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt={person.display_name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          person.display_name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="hub-fof-info">
                        <strong>{person.display_name}</strong>
                        <span className="hub-fof-mutual">
                          {person.mutual_friend_name
                            ? `🌱 Via ${person.mutual_friend_name}`
                            : `${person.mutual_friends_count} mutual friend${
                                person.mutual_friends_count === 1 ? "" : "s"
                              }`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-action-connect"
                        onClick={() => void handleSendInvite(person.id, person.display_name)}
                        disabled={actionLoadingId === person.id}
                      >
                        {actionLoadingId === person.id ? "Sending..." : "+ Connect"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 5. My Cards Showcase (Strict Policy: ONLY Card Name and Type) */}
      <section className="home-cards-showcase" aria-label="My Saved Cards">
        <div className="showcase-header">
          <div className="showcase-titles">
            <div className="showcase-badge">
              <span className="badge-chip">💳</span>
              <span>Catalog Records</span>
            </div>
            <h2>My Saved Cards</h2>
            <p>
              Your saved card records for trusted network sharing. Safe catalog selections only — zero credentials or financial numbers collected.
            </p>
          </div>

          <div className="showcase-actions">
            <Link to="/cards" className="button-secondary">
              + Add Card
            </Link>
            <Link to="/cards" className="showcase-all-link">
              View all ({cards.length}) →
            </Link>
          </div>
        </div>

        {cardsLoading ? (
          <div className="cards-loading-strip">Loading your saved cards...</div>
        ) : cards.length === 0 ? (
          <div className="cards-empty-card">
            <span className="empty-card-icon">💳</span>
            <h3>No Cards Saved Yet</h3>
            <p>
              Add your cards (name & type only) so your direct trusted network knows what cards you hold when they need assistance.
            </p>
            <Link to="/cards" className="button">
              + Add Your First Card
            </Link>
          </div>
        ) : (
          <div className="cards-horizontal-strip">
            {cards.slice(0, 4).map((card) => {
              const typeLower = card.cardType.toLowerCase();
              let cardClass = "visual-card-credit";
              if (typeLower.includes("debit")) cardClass = "visual-card-debit";
              else if (typeLower.includes("prepaid")) cardClass = "visual-card-prepaid";
              else if (typeLower.includes("virtual")) cardClass = "visual-card-virtual";
              else if (typeLower.includes("business") || typeLower.includes("corporate"))
                cardClass = "visual-card-business";

              return (
                <div key={card.id} className="home-visual-card-wrapper">
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
                        }}
                      >
                        {card.visibilityScope === "TOTAL_NETWORK" ? "🌐 Network" : "👥 Direct"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Quick Actions Hub */}
      <section className="home-gateways-hub" aria-label="Quick Actions Navigation">
        <h3 className="gateways-heading">Quick Actions</h3>
        <div className="gateways-grid">
          <button
            type="button"
            className="gateway-card"
            onClick={handleFocusSearch}
          >
            <span className="gateway-icon">🔍</span>
            <div className="gateway-content">
              <strong>Find Connections</strong>
              <span>Search people by name across the community</span>
            </div>
            <span className="gateway-arrow">→</span>
          </button>

          <Link to="/network" className="gateway-card">
            <span className="gateway-icon">👥</span>
            <div className="gateway-content">
              <strong>Explore Network</strong>
              <span>Inspect direct connections, mutuals, and reach</span>
            </div>
            <span className="gateway-arrow">→</span>
          </Link>

          <Link to="/requests" className="gateway-card">
            <span className="gateway-icon">📬</span>
            <div className="gateway-content">
              <strong>Manage Requests</strong>
              <span>Review incoming invitations & pending invites</span>
            </div>
            <span className="gateway-arrow">→</span>
          </Link>

          <Link to="/cards" className="gateway-card">
            <span className="gateway-icon">💳</span>
            <div className="gateway-content">
              <strong>Manage Cards</strong>
              <span>Add, edit, or remove your catalog card records</span>
            </div>
            <span className="gateway-arrow">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export { HomePage };
