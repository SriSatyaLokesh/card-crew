import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { resolveDisplayName } from "../lib/resolveNames";
import { NetworkGraph } from "../components/NetworkGraph";
import type { GraphFriend } from "../components/NetworkGraph";
import type { BlockedUserSummary, FriendRequestSummary, FriendshipSummary, NetworkEdge, NetworkNode } from "../types/api";

type EnrichedFriendship = FriendshipSummary & { counterpartyId: string; counterpartyName: string };
type EnrichedRequest = FriendRequestSummary & { counterpartyName: string };
type EnrichedBlock = BlockedUserSummary & { counterpartyName: string };

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
            return { ...f, counterpartyId, counterpartyName: await resolveDisplayName(counterpartyId) };
          }),
        ),
        Promise.all(
          pending
            .filter((r) => r.addressee_id === selfId)
            .map(async (r) => ({ ...r, counterpartyName: await resolveDisplayName(r.requester_id) })),
        ),
        Promise.all(
          pending
            .filter((r) => r.requester_id === selfId)
            .map(async (r) => ({ ...r, counterpartyName: await resolveDisplayName(r.addressee_id) })),
        ),
        Promise.all(blocks.map(async (b) => ({ ...b, counterpartyName: await resolveDisplayName(b.blocked_id) }))),
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

    api.getNetworkGraph(graphDepth)
      .then(({ nodes, edges }) => { setGraphNodes(nodes); setGraphEdges(edges); })
      .catch(() => { setGraphNodes([]); setGraphEdges([]); });
  }, [graphDepth, profile, friendships]);

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

      <form onSubmit={handleInvite} className="invite-form">
        <label>
          Invite by user ID
          <input value={inviteId} onChange={(event) => setInviteId(event.target.value)} required />
          <small>Email-based invites are not available yet; ask your friend for their user ID.</small>
        </label>
        <button type="submit">Send invite</button>
      </form>

      {loading && <p className="page-status">Loading your network...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}

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
          friends={graphFriends}
          edges={graphEdges}
          selfUserId={profile?.id}
          highlightedUserIds={new Set()}
          searchActive={false}
          onSelectNode={setSelectedGraphNode}
        />
        {selectedGraphNode && (
          <div className="graph-focus-panel" role="status">
            <div>
              <strong>{selectedGraphNode.display_name}</strong>
              <small>{selectedGraphNode.depth === 1 ? "Direct friend" : "Friend of friend"}</small>
            </div>
            <span>{selectedGraphNode.card_count} visible card{selectedGraphNode.card_count === 1 ? "" : "s"}</span>
            <button className="button-secondary" type="button" onClick={() => setSelectedGraphNode(null)}>Clear focus</button>
          </div>
        )}
      </section>

      <section>
        <h2>Direct friends</h2>
        {!loading && friendships.length === 0 && <p className="empty-state">No direct friends yet.</p>}
        <ul className="connection-list">
          {friendships.map((friendship) => (
            <li key={`${friendship.user_a}-${friendship.user_b}`}>
              <div className="connection-person"><strong>{friendship.counterpartyName}</strong><small>Direct friend</small></div>
              <div className="connection-actions">
                <button className="button-danger" type="button" onClick={() => void handleBlock(friendship.counterpartyId)}>Block</button>
                <button className="button-secondary" type="button" onClick={() => void handleRemoveFriend(friendship.counterpartyId)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Incoming requests</h2>
        {!loading && incoming.length === 0 && <p className="empty-state">No incoming requests.</p>}
        <ul className="connection-list">
          {incoming.map((request) => (
            <li key={request.id}>
              <div className="connection-person"><strong>{request.counterpartyName}</strong><small>Wants to connect</small></div>
              <div className="connection-actions">
                <button type="button" onClick={() => void handleAccept(request.id)}>Accept</button>
                <button className="button-secondary" type="button" onClick={() => void handleDeclineOrCancel(request.id)}>Decline</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Outgoing requests</h2>
        {!loading && outgoing.length === 0 && <p className="empty-state">No outgoing requests.</p>}
        <ul className="connection-list">
          {outgoing.map((request) => (
            <li key={request.id}>
              <div className="connection-person"><strong>{request.counterpartyName}</strong><small>Invite pending</small></div>
              <button className="button-secondary" type="button" onClick={() => void handleDeclineOrCancel(request.id)}>Cancel invite</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Blocked</h2>
        {!loading && blocked.length === 0 && <p className="empty-state">No one is blocked.</p>}
        <ul className="connection-list">
          {blocked.map((block) => (
            <li key={block.blocked_id}>
              <div className="connection-person"><strong>{block.counterpartyName}</strong><small>Blocked</small></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export { MyNetworkPage };
