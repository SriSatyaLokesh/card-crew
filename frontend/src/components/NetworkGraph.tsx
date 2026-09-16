import { useState } from "react";
import type { NetworkEdge } from "../types/api";

type GraphFriend = {
  user_id: string;
  display_name: string;
  depth: 1 | 2;
  card_count: number;
  via_user_id: string | null;
};

type NetworkGraphProps = {
  selfName: string;
  friends: GraphFriend[];
  highlightedUserIds: Set<string>;
  searchActive: boolean;
  onSelectNode?: (friend: GraphFriend) => void;
  edges?: NetworkEdge[];
  selfUserId?: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NetworkGraph({ selfName, friends, highlightedUserIds, searchActive, edges = [], selfUserId = "self", onSelectNode }: NetworkGraphProps) {
  const directFriends = friends.filter((friend) => friend.depth === 1);
  const secondDegreeFriends = friends.filter((friend) => friend.depth === 2);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const connectedNodeIds = new Set<string>();
  if (activeNodeId) {
    for (const edge of edges) {
      if (edge.from_user_id === activeNodeId) connectedNodeIds.add(edge.to_user_id);
      if (edge.to_user_id === activeNodeId) connectedNodeIds.add(edge.from_user_id);
    }
  }
  const positionedDirect = positionNodes(directFriends, 500, 300, 155);
  const positionedSecond = positionNodes(secondDegreeFriends, 500, 300, 255);
  const positions = new Map([
    [selfUserId, { x: 500, y: 300 }],
    ...positionedDirect.map(({ friend, x, y }) => [friend.user_id, { x, y }] as const),
    ...positionedSecond.map(({ friend, x, y }) => [friend.user_id, { x, y }] as const),
  ]);

  return (
    <section className="graph-view">
      <div className="graph-heading">
        <div>
          <span className="eyebrow">Trust map</span>
          <h2>Your network</h2>
        </div>
        <span className="graph-legend">{friends.length} people visible</span>
      </div>

      {friends.length === 0 ? (
        <p className="empty-state">Add a direct friend to see your network here.</p>
      ) : (
        <div className="graph-stage" aria-label="Trusted network graph">
          <svg className="graph-canvas" viewBox="0 0 1000 560" role="img" aria-label="Connected trusted network">
            {edges.map((edge) => {
              const from = positions.get(edge.from_user_id);
              const to = positions.get(edge.to_user_id);
              if (!from || !to) return null;
              const touchesActive = !activeNodeId || edge.from_user_id === activeNodeId || edge.to_user_id === activeNodeId;
              const secondDegreeEdge = edge.from_user_id !== selfUserId && edge.to_user_id !== selfUserId;
              return <line key={`${edge.from_user_id}-${edge.to_user_id}`} className={`graph-edge ${secondDegreeEdge ? "graph-edge-second" : "graph-edge-direct"}${touchesActive ? "" : " graph-edge-dimmed"}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
            })}
            <GraphSvgNode x={500} y={300} label="You" subtitle={selfName} kind="self" />
            {positionedDirect.map(({ friend, x, y }) => renderSvgNode(friend, x, y, highlightedUserIds, searchActive, activeNodeId, connectedNodeIds, setActiveNodeId, onSelectNode))}
            {positionedSecond.map(({ friend, x, y }) => renderSvgNode(friend, x, y, highlightedUserIds, searchActive, activeNodeId, connectedNodeIds, setActiveNodeId, onSelectNode))}
          </svg>
        </div>
      )}

      {!searchActive && friends.length > 0 && (
        <p className="empty-state">Search a card to highlight who can help.</p>
      )}
    </section>
  );
}

function positionNodes(nodes: GraphFriend[], centerX: number, centerY: number, radius: number) {
  return nodes.map((friend, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    return { friend, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius * 0.72 };
  });
}

function renderSvgNode(
  friend: GraphFriend,
  x: number,
  y: number,
  highlightedUserIds: Set<string>,
  searchActive: boolean,
  activeNodeId: string | null,
  connectedNodeIds: Set<string>,
  setActiveNodeId: (id: string | null) => void,
  onSelectNode?: (friend: GraphFriend) => void,
) {
  const highlighted = highlightedUserIds.has(friend.user_id);
  const active = activeNodeId === friend.user_id;
  const related = !activeNodeId || active || connectedNodeIds.has(friend.user_id);
  return (
    <g key={friend.user_id} className={`graph-svg-node ${friend.depth === 2 ? "graph-svg-second" : "graph-svg-direct"} ${highlighted ? "graph-svg-match" : ""}`}>
      <circle
        cx={x}
        cy={y}
        r={active || highlighted ? 30 : 24}
        className={!related ? "graph-svg-dimmed" : ""}
        tabIndex={0}
        role="button"
        aria-label={`${friend.display_name}, ${friend.depth === 1 ? "direct friend" : "second-degree friend"}, ${friend.card_count} visible cards`}
        onMouseEnter={() => setActiveNodeId(friend.user_id)}
        onMouseLeave={() => setActiveNodeId(null)}
        onFocus={() => setActiveNodeId(friend.user_id)}
        onBlur={() => setActiveNodeId(null)}
        onClick={() => onSelectNode?.(friend)}
      />
      <text className="graph-svg-initials" x={x} y={y + 5} textAnchor="middle">{initials(friend.display_name)}</text>
      <text className="graph-svg-name" x={x} y={y + 46} textAnchor="middle">{friend.display_name}</text>
      <text className="graph-svg-meta" x={x} y={y + 62} textAnchor="middle">{friend.card_count} cards</text>
      {searchActive && <text className="graph-svg-meta" x={x} y={y + 78} textAnchor="middle">{highlighted ? "Match" : "No match"}</text>}
    </g>
  );
}

function GraphSvgNode({ x, y, label, subtitle, kind }: { x: number; y: number; label: string; subtitle: string; kind: "self" }) {
  return (
    <g className={`graph-svg-node graph-svg-${kind}`}>
      <circle cx={x} cy={y} r="32" />
      <text className="graph-svg-initials" x={x} y={y + 5} textAnchor="middle">{initials(label)}</text>
      <text className="graph-svg-name" x={x} y={y + 52} textAnchor="middle">{subtitle}</text>
    </g>
  );
}

function renderNode(friend: GraphFriend, highlightedUserIds: Set<string>, searchActive: boolean) {
  const isMatch = highlightedUserIds.has(friend.user_id);

  return (
    <div
      key={friend.user_id}
      className={`graph-node${isMatch ? " graph-node-match" : ""}`}
    >
      <span className="graph-avatar">{initials(friend.display_name)}</span>
      <strong>{friend.display_name}</strong>
      <span className="graph-depth">{friend.depth === 1 ? "Direct friend" : "2nd degree"}</span>
      <span className="graph-count">{friend.card_count} visible card{friend.card_count === 1 ? "" : "s"}</span>
      {searchActive && <span className="graph-count">{isMatch ? "1 match" : "No match"}</span>}
    </div>
  );
}

export { NetworkGraph };
export type { GraphFriend };
