import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { resolveDisplayName, resolveUserProfile } from "../lib/resolveNames";
import { NetworkStatsDashboard } from "../components/NetworkStatsDashboard";
import type { NetworkTabType } from "../components/NetworkStatsDashboard";
import { UserSearchInput } from "../components/UserSearchInput";
import { UserListItem } from "../components/UserListItem";
import type { UserItemData } from "../components/UserListItem";
import type {
  CardCatalogSummary,
  ContactInfo,
  FriendOfFriendSummary,
  FriendRequestSummary,
  FriendshipSummary,
  NetworkStats,
  RequestStatus,
  RequestSummary,
  SearchUserSummary,
} from "../types/api";

type EnrichedCardRequest = RequestSummary & {
  counterpartyName: string;
  cardLabel: string;
};

type EnrichedFriendship = FriendshipSummary & {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
};

type EnrichedFriendRequest = FriendRequestSummary & {
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
  mutualFriendName?: string | null;
};

type EnrichedBlock = {
  id: string;
  blockedId: string;
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
};

function toWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function RequestsPage() {
  const { profile } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<NetworkTabType>("incoming");

  // Stats
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Network collections
  const [incomingRequests, setIncomingRequests] = useState<EnrichedFriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<EnrichedFriendRequest[]>([]);
  const [directFriends, setDirectFriends] = useState<EnrichedFriendship[]>([]);
  const [friendsOfFriends, setFriendsOfFriends] = useState<FriendOfFriendSummary[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<EnrichedBlock[]>([]);

  // Card requests (resource borrowing / lending)
  const [incomingCards, setIncomingCards] = useState<EnrichedCardRequest[]>([]);
  const [outgoingCards, setOutgoingCards] = useState<EnrichedCardRequest[]>([]);
  const [referralCards, setReferralCards] = useState<EnrichedCardRequest[]>([]);
  const [contactByRequestId, setContactByRequestId] = useState<Record<string, ContactInfo>>({});
  const [messageByRequestId, setMessageByRequestId] = useState<Record<string, string>>({});

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // Search by name state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUserSummary[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimerRef = useRef<number | null>(null);

  // Tab filter query
  const [tabFilterQuery, setTabFilterQuery] = useState("");

  // Load all network data & stats
  async function loadData(userId: string) {
    setError(null);
    try {
      const [
        statsData,
        { requests: allFriendRequests },
        { friendships: allFriendships },
        { friendsOfFriends: fofData },
        { blocks: allBlocks },
        { cards: catalogCards },
        { requests: allCardRequests },
      ] = await Promise.all([
        api.getNetworkStats(userId).catch(() => null),
        api.getPendingFriendRequests(userId).catch(() => ({ requests: [] })),
        api.getFriendships(userId).catch(() => ({ friendships: [] })),
        api.getFriendsOfFriends(userId).catch(() => ({ friendsOfFriends: [] })),
        api.getBlockedUsers().catch(() => ({ blocks: [] })),
        api.getCatalogCards().catch(() => ({ cards: [] })),
        api.getRequests().catch(() => ({ requests: [] })),
      ]);

      if (statsData) {
        setStats(statsData);
      }
      setStatsLoading(false);

      // 1. Process Friend Requests (Incoming & Pending/Outgoing)
      const incomingList = allFriendRequests.filter((r) => r.addressee_id === userId);
      const outgoingList = allFriendRequests.filter((r) => r.requester_id === userId);

      const [enrichedIncoming, enrichedOutgoing] = await Promise.all([
        Promise.all(
          incomingList.map(async (r) => {
            const p = await resolveUserProfile(r.requester_id);
            return {
              ...r,
              counterpartyName: p.display_name,
              counterpartyAvatarUrl: p.avatar_url,
            };
          }),
        ),
        Promise.all(
          outgoingList.map(async (r) => {
            const p = await resolveUserProfile(r.addressee_id);
            return {
              ...r,
              counterpartyName: p.display_name,
              counterpartyAvatarUrl: p.avatar_url,
            };
          }),
        ),
      ]);
      setIncomingRequests(enrichedIncoming);
      setPendingRequests(enrichedOutgoing);

      // 2. Process Direct Friends
      const enrichedFriends = await Promise.all(
        allFriendships.map(async (f) => {
          const counterpartyId = f.user_a === userId ? f.user_b : f.user_a;
          const p = await resolveUserProfile(counterpartyId);
          return {
            ...f,
            counterpartyId,
            counterpartyName: p.display_name,
            counterpartyAvatarUrl: p.avatar_url,
          };
        }),
      );
      setDirectFriends(enrichedFriends);

      // 3. Process Friends of Friends
      setFriendsOfFriends(fofData || []);

      // 4. Process Blocked Users
      const enrichedBlocks = await Promise.all(
        allBlocks.map(async (b) => {
          const p = await resolveUserProfile(b.blocked_id);
          return {
            id: `${b.blocker_id}-${b.blocked_id}`,
            blockedId: b.blocked_id,
            counterpartyName: b.user?.display_name || p.display_name,
            counterpartyAvatarUrl: p.avatar_url,
          };
        }),
      );
      setBlockedUsers(enrichedBlocks);

      // 5. Process Card Requests
      const cardsLookup = new Map(catalogCards.map((card) => [card.id, card]));
      async function enrichCardRequests(
        requests: RequestSummary[],
        counterpartyOf: (r: RequestSummary) => string,
      ) {
        return Promise.all(
          requests.map(async (req) => {
            const counterpartyName = await resolveDisplayName(counterpartyOf(req));
            let cardLabel = "A card";
            try {
              const { resource } = await api.getResource(req.resource_id);
              const card = cardsLookup.get(resource.catalog_item_id);
              cardLabel = card ? `${card.issuer} ${card.product_name}` : resource.catalog_item_id;
            } catch {
              // fallback
            }
            return { ...req, counterpartyName, cardLabel };
          }),
        );
      }

      const [inCards, outCards, refCards] = await Promise.all([
        enrichCardRequests(
          allCardRequests.filter((r) => r.owner_id === userId),
          (r) => r.requester_id,
        ),
        enrichCardRequests(
          allCardRequests.filter((r) => r.requester_id === userId),
          (r) => r.owner_id,
        ),
        enrichCardRequests(
          allCardRequests.filter((r) => r.intermediary_id === userId),
          (r) => r.requester_id,
        ),
      ]);
      setIncomingCards(inCards);
      setOutgoingCards(outCards);
      setReferralCards(refCards);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load network requests");
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    if (profile) {
      void loadData(profile.id);
    }
  }, [profile]);

  // Handle Search Debounce
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const query = searchQuery.trim();
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
        setSearchResults(users.filter((u) => u.id !== profile.id));
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
  }, [searchQuery, profile]);

  // Actions
  async function handleSendInvite(targetUserId: string, targetName: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setBusyActionId(targetUserId);

    try {
      await api.sendFriendRequest(targetUserId);
      setSuccess(`Connection invite sent to ${targetName}!`);
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send connection invite");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleAccept(requestId: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setBusyActionId(requestId);

    try {
      await api.acceptFriendRequest(requestId);
      setSuccess("Connection accepted! User is now in your direct network.");
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept connection request");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleDecline(requestId: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setBusyActionId(requestId);

    try {
      await api.declineFriendRequest(requestId);
      setSuccess("Request declined.");
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to decline request");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleCancel(requestId: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setBusyActionId(requestId);

    try {
      await api.declineFriendRequest(requestId);
      setSuccess("Invite cancelled.");
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel invite");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleRemoveFriend(friendId: string, friendName: string) {
    if (!profile) return;
    if (!window.confirm(`Are you sure you want to remove ${friendName} from your trusted network?`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    setBusyActionId(friendId);

    try {
      await api.removeFriend(friendId);
      setSuccess(`Removed ${friendName} from direct friends.`);
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove friend");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleBlock(targetId: string, targetName: string) {
    if (!profile) return;
    if (
      !window.confirm(
        `Block ${targetName}? This disconnects you and prevents future connection requests.`,
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    setBusyActionId(targetId);

    try {
      await api.blockUser(targetId);
      setSuccess(`Blocked ${targetName}.`);
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to block user");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleUnblock(targetId: string, targetName: string) {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setBusyActionId(targetId);

    try {
      await api.unblockUser(targetId);
      setSuccess(`Unblocked ${targetName}.`);
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to unblock user");
    } finally {
      setBusyActionId(null);
    }
  }

  // Card Request Actions
  async function handleCardStatusChange(request: EnrichedCardRequest, status: RequestStatus) {
    if (!profile) return;
    setError(null);
    setBusyActionId(request.id);
    try {
      await api.respondToRequest(request.id, status);
      setSuccess(`Card request ${status}.`);
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update card request");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleViewContact(request: EnrichedCardRequest) {
    if (!profile) return;
    setError(null);
    try {
      const { contact } = await api.revealContact(request.id, messageByRequestId[request.id]);
      setContactByRequestId((prev) => ({ ...prev, [request.id]: contact }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load contact info");
    }
  }

  async function handleReferralStatus(
    request: EnrichedCardRequest,
    status: "approved" | "declined" | "ignored",
  ) {
    if (!profile) return;
    setError(null);
    setBusyActionId(request.id);
    try {
      await api.respondToReferral(request.id, status);
      setSuccess(`Referral ${status}.`);
      await loadData(profile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update referral");
    } finally {
      setBusyActionId(null);
    }
  }

  // Filtered lists per tab
  const filterLower = tabFilterQuery.toLowerCase().trim();

  const filteredIncoming = useMemo(() => {
    if (!filterLower) return incomingRequests;
    return incomingRequests.filter((r) => r.counterpartyName.toLowerCase().includes(filterLower));
  }, [incomingRequests, filterLower]);

  const filteredPending = useMemo(() => {
    if (!filterLower) return pendingRequests;
    return pendingRequests.filter((r) => r.counterpartyName.toLowerCase().includes(filterLower));
  }, [pendingRequests, filterLower]);

  const filteredFriends = useMemo(() => {
    if (!filterLower) return directFriends;
    return directFriends.filter((f) => f.counterpartyName.toLowerCase().includes(filterLower));
  }, [directFriends, filterLower]);

  const filteredFoF = useMemo(() => {
    if (!filterLower) return friendsOfFriends;
    return friendsOfFriends.filter(
      (f) =>
        f.display_name.toLowerCase().includes(filterLower) ||
        (f.mutual_friend_name && f.mutual_friend_name.toLowerCase().includes(filterLower)),
    );
  }, [friendsOfFriends, filterLower]);

  const filteredBlocked = useMemo(() => {
    if (!filterLower) return blockedUsers;
    return blockedUsers.filter((b) => b.counterpartyName.toLowerCase().includes(filterLower));
  }, [blockedUsers, filterLower]);

  return (
    <div className="page">
      <div className="page-heading-row">
        <div>
          <h1>Requests &amp; Connections</h1>
          <p className="page-intro">
            Manage your network invitations, discover friends of friends, and monitor your trust connections.
          </p>
        </div>
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

      {/* 1. Six-Stat Network Dashboard */}
      <NetworkStatsDashboard
        stats={stats}
        loading={statsLoading}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setTabFilterQuery("");
        }}
      />

      {/* 2. Global User Search Input */}
      <section className="network-search-card">
        <div className="network-search-heading">
          <div>
            <h2>Find &amp; Connect with Anyone</h2>
            <small>
              Search by name or email. If they share mutual friends, their trust path will be highlighted!
            </small>
          </div>
        </div>

        <UserSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchResults([])}
          isSearching={isSearching}
          placeholder="Search by name or username (e.g. Sarah, Elena, Arjun)..."
        />

        {/* Live Search Results */}
        {hasSearched && !isSearching && searchResults.length === 0 && (
          <p className="empty-state" style={{ marginTop: "1rem" }}>
            No users found matching &ldquo;<strong>{searchQuery}</strong>&rdquo;. Try searching with another name.
          </p>
        )}

        {searchResults.length > 0 && (
          <div style={{ marginTop: "1.25rem" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--ink-800)" }}>
              Search Results ({searchResults.length})
            </h3>
            <ul className="search-results-list">
              {searchResults.map((user) => {
                const userItem: UserItemData = {
                  id: user.id,
                  display_name: user.display_name,
                  email: user.email,
                  relationship: user.relationship,
                  mutualFriendName: user.mutual_friend_name,
                  mutualFriendCount: user.mutual_friend_count,
                  requestId: user.connection_id || undefined,
                  avatar_url: user.avatar_url,
                };

                return (
                  <UserListItem
                    key={user.id}
                    user={userItem}
                    onSendInvite={handleSendInvite}
                    onAcceptRequest={handleAccept}
                    onDeclineRequest={handleDecline}
                    onCancelRequest={handleCancel}
                    onRemoveFriend={handleRemoveFriend}
                    onBlock={handleBlock}
                    onUnblock={handleUnblock}
                    isBusy={busyActionId === user.id || busyActionId === user.connection_id}
                    showBlockOption
                  />
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 3. Navigation Tabs */}
      <div className="network-segmented-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          className={`network-tab-button ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <span>📋 All Requests</span>
          <span className="tab-badge">
            {incomingRequests.length + pendingRequests.length + incomingCards.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "incoming"}
          className={`network-tab-button ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          <span>📥 Incoming</span>
          <span className={`tab-badge ${incomingRequests.length > 0 ? "badge-alert" : ""}`}>
            {incomingRequests.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pending"}
          className={`network-tab-button ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          <span>📤 Pending</span>
          <span className="tab-badge">{pendingRequests.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "friends"}
          className={`network-tab-button ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          <span>👥 Direct Friends</span>
          <span className="tab-badge">{directFriends.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "fof"}
          className={`network-tab-button ${activeTab === "fof" ? "active" : ""}`}
          onClick={() => setActiveTab("fof")}
        >
          <span>🌱 Friends of Friends</span>
          <span className="tab-badge">{friendsOfFriends.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "blocked"}
          className={`network-tab-button ${activeTab === "blocked" ? "active" : ""}`}
          onClick={() => setActiveTab("blocked")}
        >
          <span>🛡️ Blocked</span>
          <span className="tab-badge">{blockedUsers.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "cards"}
          className={`network-tab-button ${activeTab === "cards" ? "active" : ""}`}
          onClick={() => setActiveTab("cards")}
        >
          <span>💳 Card Handoffs</span>
          <span className="tab-badge">
            {incomingCards.length + outgoingCards.length + referralCards.length}
          </span>
        </button>
      </div>

      {/* Filter inside tab if applicable */}
      {activeTab !== "cards" && (
        <div style={{ marginBottom: "1rem" }}>
          <input
            className="friends-search-input"
            type="search"
            placeholder={`Filter in current tab (${activeTab})...`}
            value={tabFilterQuery}
            onChange={(e) => setTabFilterQuery(e.target.value)}
            style={{ width: "100%", maxWidth: "340px" }}
          />
        </div>
      )}

      {loading && <p className="page-status">Loading network information...</p>}

      {/* TAB CONTENT */}

      {/* Tab: ALL REQUESTS */}
      {activeTab === "all" && !loading && (
        <section>
          {incomingRequests.length === 0 && pendingRequests.length === 0 && incomingCards.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📬</div>
              <h3>No active requests</h3>
              <p style={{ color: "var(--ink-600)" }}>
                You have no pending incoming or outgoing connection requests.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {incomingRequests.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "var(--ink-900)" }}>
                    Incoming Friend Requests ({incomingRequests.length})
                  </h3>
                  <ul className="search-results-list">
                    {incomingRequests.map((req) => (
                      <UserListItem
                        key={req.id}
                        user={{
                          id: req.requester_id,
                          display_name: req.counterpartyName,
                          relationship: "incoming_request",
                          requestId: req.id,
                          createdAt: req.created_at,
                          avatar_url: req.counterpartyAvatarUrl,
                        }}
                        onAcceptRequest={handleAccept}
                        onDeclineRequest={handleDecline}
                        isBusy={busyActionId === req.id}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {pendingRequests.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "var(--ink-900)" }}>
                    Pending Outgoing Invites ({pendingRequests.length})
                  </h3>
                  <ul className="search-results-list">
                    {pendingRequests.map((req) => (
                      <UserListItem
                        key={req.id}
                        user={{
                          id: req.addressee_id,
                          display_name: req.counterpartyName,
                          relationship: "outgoing_request",
                          requestId: req.id,
                          createdAt: req.created_at,
                          avatar_url: req.counterpartyAvatarUrl,
                        }}
                        onCancelRequest={handleCancel}
                        isBusy={busyActionId === req.id}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Tab: INCOMING */}
      {activeTab === "incoming" && !loading && (
        <section>
          {filteredIncoming.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📥</div>
              <h3>No incoming requests</h3>
              <p style={{ color: "var(--ink-600)" }}>
                When other users want to connect with you, their requests will appear here.
              </p>
            </div>
          ) : (
            <ul className="search-results-list">
              {filteredIncoming.map((req) => (
                <UserListItem
                  key={req.id}
                  user={{
                    id: req.requester_id,
                    display_name: req.counterpartyName,
                    relationship: "incoming_request",
                    requestId: req.id,
                    createdAt: req.created_at,
                    avatar_url: req.counterpartyAvatarUrl,
                  }}
                  onAcceptRequest={handleAccept}
                  onDeclineRequest={handleDecline}
                  isBusy={busyActionId === req.id}
                  showBlockOption
                  onBlock={() => handleBlock(req.requester_id, req.counterpartyName)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tab: PENDING */}
      {activeTab === "pending" && !loading && (
        <section>
          {filteredPending.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📤</div>
              <h3>No pending invites</h3>
              <p style={{ color: "var(--ink-600)" }}>
                You haven&apos;t sent any connection requests that are awaiting approval.
              </p>
            </div>
          ) : (
            <ul className="search-results-list">
              {filteredPending.map((req) => (
                <UserListItem
                  key={req.id}
                  user={{
                    id: req.addressee_id,
                    display_name: req.counterpartyName,
                    relationship: "outgoing_request",
                    requestId: req.id,
                    createdAt: req.created_at,
                    avatar_url: req.counterpartyAvatarUrl,
                  }}
                  onCancelRequest={handleCancel}
                  isBusy={busyActionId === req.id}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tab: DIRECT FRIENDS */}
      {activeTab === "friends" && !loading && (
        <section>
          {filteredFriends.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👥</div>
              <h3>No direct friends yet</h3>
              <p style={{ color: "var(--ink-600)" }}>
                Search for your friends by name above and send them a connection invite!
              </p>
            </div>
          ) : (
            <ul className="search-results-list">
              {filteredFriends.map((f) => (
                <UserListItem
                  key={`${f.user_a}-${f.user_b}`}
                  user={{
                    id: f.counterpartyId,
                    display_name: f.counterpartyName,
                    relationship: "direct_friend",
                    createdAt: f.created_at,
                    avatar_url: f.counterpartyAvatarUrl,
                  }}
                  onRemoveFriend={handleRemoveFriend}
                  onBlock={handleBlock}
                  showBlockOption
                  isBusy={busyActionId === f.counterpartyId}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tab: FRIENDS OF FRIENDS */}
      {activeTab === "fof" && !loading && (
        <section>
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--ink-600)" }}>
              These are 2nd-degree connections in your extended trust network. Connect with them to expand your circle!
            </p>
          </div>

          {filteredFoF.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🌱</div>
              <h3>No friends of friends found</h3>
              <p style={{ color: "var(--ink-600)" }}>
                As you and your friends connect with more people, your extended network will blossom here.
              </p>
            </div>
          ) : (
            <ul className="search-results-list">
              {filteredFoF.map((fof) => (
                <UserListItem
                  key={fof.id}
                  user={{
                    id: fof.id,
                    display_name: fof.display_name,
                    email: fof.email,
                    relationship: "friend_of_friend",
                    mutualFriendName: fof.mutual_friend_name,
                    mutualFriendCount: fof.mutual_friends_count,
                    avatar_url: fof.avatar_url,
                  }}
                  onSendInvite={handleSendInvite}
                  onBlock={handleBlock}
                  showBlockOption
                  isBusy={busyActionId === fof.id}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tab: BLOCKED */}
      {activeTab === "blocked" && !loading && (
        <section>
          {filteredBlocked.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🛡️</div>
              <h3>No blocked users</h3>
              <p style={{ color: "var(--ink-600)" }}>You have not blocked any users.</p>
            </div>
          ) : (
            <ul className="search-results-list">
              {filteredBlocked.map((b) => (
                <UserListItem
                  key={b.id}
                  user={{
                    id: b.blockedId,
                    display_name: b.counterpartyName,
                    relationship: "blocked",
                    avatar_url: b.counterpartyAvatarUrl,
                  }}
                  onUnblock={handleUnblock}
                  isBusy={busyActionId === b.blockedId}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tab: CARD HANDOFFS (Resource Requests) */}
      {activeTab === "cards" && !loading && (
        <section>
          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--ink-600)" }}>
              Borrowing and lending requests for cards in your network.
            </span>
          </div>

          {incomingCards.length === 0 && outgoingCards.length === 0 && referralCards.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💳</div>
              <h3>No card handoff requests</h3>
              <p style={{ color: "var(--ink-600)" }}>
                When network members request to borrow cards, requests appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {/* Referrals */}
              {referralCards.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1.05rem", marginBottom: "0.5rem", color: "var(--ink-900)" }}>
                    Referrals Requiring Your Action ({referralCards.length})
                  </h3>
                  <ul className="request-list">
                    {referralCards.map((request) => (
                      <li key={request.id}>
                        <div className="request-meta">
                          <strong>{request.counterpartyName}</strong>
                          <span>{request.cardLabel}</span>
                          <span className={`badge badge-${request.referral_status}`}>
                            {request.referral_status}
                          </span>
                        </div>
                        {request.message && <p>&ldquo;{request.message}&rdquo;</p>}
                        {request.referral_status === "pending" && (
                          <div className="request-actions">
                            <button
                              type="button"
                              disabled={busyActionId === request.id}
                              onClick={() => void handleReferralStatus(request, "approved")}
                            >
                              Refer requester
                            </button>
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={busyActionId === request.id}
                              onClick={() => void handleReferralStatus(request, "declined")}
                            >
                              Decline referral
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Incoming Card Requests */}
              {incomingCards.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1.05rem", marginBottom: "0.5rem", color: "var(--ink-900)" }}>
                    Incoming Card Borrowing Requests ({incomingCards.length})
                  </h3>
                  <ul className="request-list">
                    {incomingCards.map((request) => {
                      const contact = contactByRequestId[request.id];
                      return (
                        <li key={request.id}>
                          <div className="request-meta">
                            <strong>{request.counterpartyName}</strong>
                            <span>{request.cardLabel}</span>
                            <span className={`badge badge-${request.status}`}>{request.status}</span>
                          </div>
                          {request.message && <p>&ldquo;{request.message}&rdquo;</p>}

                          {request.status === "pending" && (
                            <div className="request-actions">
                              <button
                                type="button"
                                disabled={busyActionId === request.id}
                                onClick={() => void handleCardStatusChange(request, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyActionId === request.id}
                                onClick={() => void handleCardStatusChange(request, "declined")}
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                disabled={busyActionId === request.id}
                                onClick={() => void handleCardStatusChange(request, "ignored")}
                              >
                                Ignore
                              </button>
                            </div>
                          )}

                          {request.status === "approved" && !contact && (
                            <div className="handoff-panel">
                              <label>
                                WhatsApp message <span className="label-optional">optional</span>
                                <textarea
                                  rows={3}
                                  value={messageByRequestId[request.id] ?? ""}
                                  placeholder="Hi, I’m reaching out through Card Crew about a card request."
                                  onChange={(event) =>
                                    setMessageByRequestId((current) => ({
                                      ...current,
                                      [request.id]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <button type="button" onClick={() => void handleViewContact(request)}>
                                Prepare contact handoff
                              </button>
                            </div>
                          )}

                          {contact && (
                            <p className="form-success">
                              Contact details available: {contact.display_name}
                              {contact.phone ? ` (${contact.phone})` : ""}
                              {contact.phone && (
                                <>
                                  <br />
                                  <a
                                    href={toWhatsAppUrl(contact.phone, contact.whatsapp_message)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open WhatsApp with message
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Outgoing Card Requests */}
              {outgoingCards.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1.05rem", marginBottom: "0.5rem", color: "var(--ink-900)" }}>
                    Your Outgoing Card Requests ({outgoingCards.length})
                  </h3>
                  <ul className="request-list">
                    {outgoingCards.map((request) => (
                      <li key={request.id}>
                        <div className="request-meta">
                          <strong>{request.counterpartyName}</strong>
                          <span>{request.cardLabel}</span>
                          <span className={`badge badge-${request.status}`}>{request.status}</span>
                        </div>
                        {request.message && <p>&ldquo;{request.message}&rdquo;</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
