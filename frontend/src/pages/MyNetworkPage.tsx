import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { resolveDisplayName } from "../lib/resolveNames";
import { NetworkGraph } from "../components/NetworkGraph";
import type { GraphFriend } from "../components/NetworkGraph";
import type { ConnectionSummary, NetworkEdge, NetworkNode } from "../types/api";

type EnrichedConnection = ConnectionSummary & { counterpartyName: string };

function MyNetworkPage() {
  const { profile } = useAuth();
  const [connections, setConnections] = useState<EnrichedConnection[]>([]);
  const [inviteId, setInviteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [graphDepth, setGraphDepth] = useState<1 | 2>(2);
  const [graphNodes, setGraphNodes] = useState<NetworkNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<NetworkEdge[]>([]);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphFriend | null>(null);

  async function loadConnections(userId: string) {
    setLoading(true);
    setError(null);

    try {
      const { connections: allConnections } = await api.getConnections(userId);
      const enriched = await Promise.all(
        allConnections.map(async (connection) => ({
          ...connection,
          counterpartyName: await resolveDisplayName(
            connection.requester_id === userId ? connection.addressee_id : connection.requester_id,
          ),
        })),
      );
      setConnections(enriched);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load your network");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) {
      void loadConnections(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    api.getNetworkGraph(profile.id, graphDepth)
      .then(({ nodes, edges }) => { setGraphNodes(nodes); setGraphEdges(edges); })
      .catch(() => { setGraphNodes([]); setGraphEdges([]); });
  }, [graphDepth, profile, connections]);

  const grouped = useMemo(() => {
    if (!profile) {
      return { direct: [], incoming: [], outgoing: [], blocked: [] };
    }

    return {
      direct: connections.filter((c) => c.status === "accepted"),
      incoming: connections.filter((c) => c.status === "pending" && c.addressee_id === profile.id),
      outgoing: connections.filter((c) => c.status === "pending" && c.requester_id === profile.id),
      blocked: connections.filter((c) => c.status === "blocked"),
    };
  }, [connections, profile]);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();

    if (!profile || !inviteId.trim()) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.sendConnectionRequest(profile.id, inviteId.trim());
      setInviteId("");
      setSuccess("Invite sent.");
      await loadConnections(profile.id);
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : "Failed to send invite");
    }
  }

  async function handleAccept(connectionId: string) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.acceptConnection(connectionId, profile.id);
      setSuccess("Connection accepted.");
      await loadConnections(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to accept connection");
    }
  }

  async function handleRemove(connectionId: string) {
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.removeConnection(connectionId, profile.id);
      setSuccess("Connection removed.");
      await loadConnections(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to remove connection");
    }
  }

  async function handleBlock(connectionId: string) {
    if (!profile) {
      return;
    }

    if (!window.confirm("Blocking removes this connection and prevents future requests between you.")) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.blockConnection(connectionId, profile.id);
      setSuccess("Connection blocked.");
      await loadConnections(profile.id);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Failed to block connection");
    }
  }

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
          friends={graphNodes.filter((node) => node.depth > 0) as GraphFriend[]}
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
        {!loading && grouped.direct.length === 0 && <p className="empty-state">No direct friends yet.</p>}
        <ul className="connection-list">
          {grouped.direct.map((connection) => (
            <li key={connection.id}>
              <div className="connection-person"><strong>{connection.counterpartyName}</strong><small>Direct friend</small></div>
              <div className="connection-actions">
                <button className="button-danger" type="button" onClick={() => void handleBlock(connection.id)}>Block</button>
                <button className="button-secondary" type="button" onClick={() => void handleRemove(connection.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Incoming requests</h2>
        {!loading && grouped.incoming.length === 0 && <p className="empty-state">No incoming requests.</p>}
        <ul className="connection-list">
          {grouped.incoming.map((connection) => (
            <li key={connection.id}>
              <div className="connection-person"><strong>{connection.counterpartyName}</strong><small>Wants to connect</small></div>
              <div className="connection-actions">
                <button type="button" onClick={() => void handleAccept(connection.id)}>Accept</button>
                <button className="button-secondary" type="button" onClick={() => void handleRemove(connection.id)}>Decline</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Outgoing requests</h2>
        {!loading && grouped.outgoing.length === 0 && <p className="empty-state">No outgoing requests.</p>}
        <ul className="connection-list">
          {grouped.outgoing.map((connection) => (
            <li key={connection.id}>
              <div className="connection-person"><strong>{connection.counterpartyName}</strong><small>Invite pending</small></div>
              <button className="button-secondary" type="button" onClick={() => void handleRemove(connection.id)}>Cancel invite</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Blocked</h2>
        {!loading && grouped.blocked.length === 0 && <p className="empty-state">No one is blocked.</p>}
        <ul className="connection-list">
          {grouped.blocked.map((connection) => (
            <li key={connection.id}>
              <div className="connection-person"><strong>{connection.counterpartyName}</strong><small>Blocked</small></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export { MyNetworkPage };
