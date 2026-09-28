import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { NetworkEdge } from "../types/api";

export type GraphFriend = {
  user_id: string;
  display_name: string;
  depth: 1 | 2;
  card_count: number;
  via_user_id: string | null;
  avatar_url?: string | null;
};

export type NetworkGraphProps = {
  selfName: string;
  selfAvatarUrl?: string | null;
  friends: GraphFriend[];
  highlightedUserIds?: Set<string>;
  searchActive?: boolean;
  edges?: NetworkEdge[];
  selfUserId?: string;
  onSelectNode?: (friend: GraphFriend) => void;
};

interface SimNode {
  id: string;
  name: string;
  fullName: string;
  depth: 0 | 1 | 2;
  cardCount: number;
  viaUserId: string | null;
  avatarUrl?: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isSelf: boolean;
  isDirect: boolean;
  isHighlighted: boolean;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  source: SimNode;
  target: SimNode;
  isDirect: boolean;
}

export function NetworkGraph({
  selfName,
  selfAvatarUrl,
  friends,
  highlightedUserIds = new Set(),
  edges = [],
  selfUserId = "self",
  onSelectNode,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeNode, setActiveNode] = useState<SimNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<SimNode | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Avatar image cache to avoid recreating Image elements on canvas render loops
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [avatarVersion, setAvatarVersion] = useState(0);

  const getOrLoadImage = useCallback((url: string): HTMLImageElement | null => {
    if (!url) return null;
    let img = imageCacheRef.current.get(url);
    if (!img) {
      img = new Image();
      // Only set crossOrigin on remote HTTP/HTTPS images to prevent CORS failures on base64 data URIs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        setAvatarVersion((v) => v + 1);
      };
      img.onerror = () => {
        // Silent catch for invalid avatar URLs
      };
      img.src = url;
      imageCacheRef.current.set(url, img);
    }
    return img;
  }, []);

  // Build simulation nodes and links from real network data
  const { initialNodes, initialLinks } = useMemo(() => {
    const nodes: SimNode[] = [];

    // Self Node (Center Core)
    nodes.push({
      id: selfUserId,
      name: "You",
      fullName: selfName || "You",
      depth: 0,
      cardCount: 0,
      viaUserId: null,
      avatarUrl: selfAvatarUrl || null,
      x: 450,
      y: 260,
      vx: 0,
      vy: 0,
      radius: selfAvatarUrl ? 16 : 11,
      color: "#ffffff",
      isSelf: true,
      isDirect: false,
      isHighlighted: false,
    });

    const directFriends = friends.filter((f) => f.depth === 1);
    const secondDegreeFriends = friends.filter((f) => f.depth === 2);

    // Add Direct Friends (depth 1)
    directFriends.forEach((f, idx) => {
      const angle = (idx / Math.max(directFriends.length, 1)) * Math.PI * 2;
      const dist = 110 + (idx % 2) * 20;
      const shortName = f.display_name.trim().split(" ")[0] || f.display_name;

      nodes.push({
        id: f.user_id,
        name: shortName,
        fullName: f.display_name,
        depth: 1,
        cardCount: f.card_count,
        viaUserId: null,
        avatarUrl: f.avatar_url || null,
        x: 450 + Math.cos(angle) * dist,
        y: 260 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: f.avatar_url ? 14 : 8,
        color: "#10b981", // Emerald green for direct friends
        isSelf: false,
        isDirect: true,
        isHighlighted: highlightedUserIds.has(f.user_id),
      });
    });

    // Add Friends of Friends (depth 2)
    secondDegreeFriends.forEach((f, idx) => {
      const angle = (idx / Math.max(secondDegreeFriends.length, 1)) * Math.PI * 2;
      const dist = 210 + (idx % 3) * 25;
      const shortName = f.display_name.trim().split(" ")[0] || f.display_name;

      nodes.push({
        id: f.user_id,
        name: shortName,
        fullName: f.display_name,
        depth: 2,
        cardCount: f.card_count,
        viaUserId: f.via_user_id,
        avatarUrl: f.avatar_url || null,
        x: 450 + Math.cos(angle) * dist,
        y: 260 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: f.avatar_url ? 11 : 6.5,
        color: "#38bdf8", // Electric cyan for friends of friends
        isSelf: false,
        isDirect: false,
        isHighlighted: highlightedUserIds.has(f.user_id),
      });
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = [];

    // Connect edges
    if (edges && edges.length > 0) {
      edges.forEach((edge) => {
        const src = nodeMap.get(edge.from_user_id);
        const tgt = nodeMap.get(edge.to_user_id);
        if (src && tgt) {
          const isDirect = src.isSelf || tgt.isSelf;
          links.push({ source: src, target: tgt, isDirect });
        }
      });
    }

    // Connect direct friends to self
    const selfNode = nodeMap.get(selfUserId);
    if (selfNode) {
      directFriends.forEach((df) => {
        const target = nodeMap.get(df.user_id);
        if (target && !links.some((l) => (l.source.id === selfNode.id && l.target.id === target.id) || (l.source.id === target.id && l.target.id === selfNode.id))) {
          links.push({ source: selfNode, target, isDirect: true });
        }
      });

      // Connect 2nd degree friends to their respective via_user_id
      secondDegreeFriends.forEach((sf) => {
        const target = nodeMap.get(sf.user_id);
        if (target && sf.via_user_id && nodeMap.has(sf.via_user_id)) {
          const parent = nodeMap.get(sf.via_user_id)!;
          if (!links.some((l) => (l.source.id === parent.id && l.target.id === target.id) || (l.source.id === target.id && l.target.id === parent.id))) {
            links.push({ source: parent, target, isDirect: false });
          }
        } else if (target && directFriends.length > 0 && directFriends[0]) {
          // If no specific via_user_id, connect to first direct friend
          const fallbackParent = nodeMap.get(directFriends[0].user_id);
          if (fallbackParent && !links.some((l) => (l.source.id === fallbackParent.id && l.target.id === target.id) || (l.source.id === target.id && l.target.id === fallbackParent.id))) {
            links.push({ source: fallbackParent, target, isDirect: false });
          }
        }
      });
    }

    return { initialNodes: nodes, initialLinks: links };
  }, [friends, edges, selfUserId, selfName, selfAvatarUrl, highlightedUserIds]);

  // Keep references to live nodes/links for simulation loop
  useEffect(() => {
    simNodesRef.current = initialNodes;
    simLinksRef.current = initialLinks;
  }, [initialNodes, initialLinks]);

  // Preload avatars
  useEffect(() => {
    initialNodes.forEach((node) => {
      if (node.avatarUrl) {
        getOrLoadImage(node.avatarUrl);
      }
    });
  }, [initialNodes, getOrLoadImage]);

  // Physics animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isRunning = true;
    let iteration = 0;

    const render = () => {
      if (!isRunning) return;
      iteration++;

      const nodes = simNodesRef.current;
      const links = simLinksRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx && nodes.length > 0) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const displayWidth = Math.floor(rect.width);
        const displayHeight = Math.floor(rect.height);

        if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
          canvas.width = displayWidth * dpr;
          canvas.height = displayHeight * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        // Obsidian deep constellation background
        ctx.fillStyle = "#0c0e14";
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Ambient star dust points
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        for (let gx = 25; gx < displayWidth; gx += 45) {
          for (let gy = 25; gy < displayHeight; gy += 45) {
            ctx.fillRect(gx, gy, 1, 1);
          }
        }

        // Apply pan & zoom transforms
        ctx.translate(displayWidth / 2 + pan.x, displayHeight / 2 + pan.y);
        ctx.scale(zoom, zoom);
        ctx.translate(-displayWidth / 2, -displayHeight / 2);

        // Physics step (cool down over ~300 frames unless dragging)
        if (iteration < 320 || draggedNode) {
          const centerX = displayWidth / 2;
          const centerY = displayHeight / 2;
          const kRepulse = 1600;
          const kSpring = 0.032;
          const springLength = 85;
          const damping = 0.85;

          // Node-to-node repulsion
          for (let i = 0; i < nodes.length; i++) {
            const n1 = nodes[i];
            if (!n1) continue;
            for (let j = i + 1; j < nodes.length; j++) {
              const n2 = nodes[j];
              if (!n2) continue;
              const dx = n2.x - n1.x;
              const dy = n2.y - n1.y;
              const distSq = dx * dx + dy * dy || 1;
              const dist = Math.sqrt(distSq);

              if (dist < 280) {
                const force = kRepulse / (distSq + 200);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (!n1.fx) { n1.vx -= fx; n1.vy -= fy; }
                if (!n2.fx) { n2.vx += fx; n2.vy += fy; }
              }
            }

            // Central gravity pull towards center
            const toCenterX = centerX - n1.x;
            const toCenterY = centerY - n1.y;
            if (!n1.fx) {
              n1.vx += toCenterX * 0.0016;
              n1.vy += toCenterY * 0.0016;
            }
          }

          // Edge spring forces
          for (const link of links) {
            const dx = link.target.x - link.source.x;
            const dy = link.target.y - link.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetDist = link.isDirect ? springLength : springLength * 1.4;
            const displacement = dist - targetDist;
            const force = displacement * kSpring;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!link.source.fx) { link.source.vx += fx; link.source.vy += fy; }
            if (!link.target.fx) { link.target.vx -= fx; link.target.vy -= fy; }
          }

          // Apply velocity and damping
          for (const n of nodes) {
            if (n.fx !== undefined && n.fx !== null) {
              n.x = n.fx;
              n.y = n.fy!;
              n.vx = 0;
              n.vy = 0;
            } else {
              n.vx *= damping;
              n.vy *= damping;
              n.x += n.vx;
              n.y += n.vy;
            }
          }
        }

        // Active node neighborhood detection for hover highlighting
        const highlightId = hoveredNode?.id || activeNode?.id;
        const connectedIds = new Set<string>();
        if (highlightId) {
          connectedIds.add(highlightId);
          for (const link of links) {
            if (link.source.id === highlightId) connectedIds.add(link.target.id);
            if (link.target.id === highlightId) connectedIds.add(link.source.id);
          }
        }

        // 1. Draw connecting web edges
        for (const link of links) {
          const isConnected = highlightId ? (connectedIds.has(link.source.id) && connectedIds.has(link.target.id)) : true;
          const isDimmed = highlightId && !isConnected;

          ctx.beginPath();
          ctx.moveTo(link.source.x, link.source.y);
          ctx.lineTo(link.target.x, link.target.y);

          if (isConnected && highlightId) {
            ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
            ctx.lineWidth = 2.2;
          } else if (isDimmed) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
            ctx.lineWidth = 0.8;
          } else {
            ctx.strokeStyle = link.isDirect ? "rgba(16, 185, 129, 0.45)" : "rgba(56, 189, 248, 0.35)";
            ctx.lineWidth = link.isDirect ? 1.5 : 1.0;
          }
          ctx.stroke();
        }

        // 2. Draw nodes (avatar inside circle if available, otherwise as-is dot)
        for (const node of nodes) {
          const isCurrentActive = highlightId === node.id;
          const isNeighbor = connectedIds.has(node.id);
          const isDimmed = highlightId && !isCurrentActive && !isNeighbor;

          const r = isCurrentActive ? (node.avatarUrl ? node.radius * 1.3 : node.radius * 1.5) : node.radius;

          const img = node.avatarUrl ? getOrLoadImage(node.avatarUrl) : null;
          const hasImageLoaded = Boolean(img && img.complete && img.naturalWidth > 0);

          if (hasImageLoaded && img) {
            // Draw avatar clipped inside circular node
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.closePath();

            // Glow / Shadow behind avatar
            if (isCurrentActive) {
              ctx.shadowColor = node.color;
              ctx.shadowBlur = 18;
            } else if (!isDimmed) {
              ctx.shadowColor = node.color;
              ctx.shadowBlur = node.isSelf ? 14 : node.isDirect ? 10 : 8;
            }

            // Fill background circle in case avatar has transparency
            ctx.fillStyle = isDimmed ? "rgba(30, 35, 45, 0.85)" : "rgba(15, 23, 42, 0.95)";
            ctx.fill();

            // Clip to circle and draw avatar with aspect-ratio-preserving center crop
            ctx.clip();
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            const minDim = Math.min(nw, nh);
            const sx = (nw - minDim) / 2;
            const sy = (nh - minDim) / 2;
            const size = r * 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, node.x - r, node.y - r, size, size);

            if (isDimmed) {
              // Dimming overlay on top of avatar
              ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
              ctx.fillRect(node.x - r, node.y - r, size, size);
            }
            ctx.restore();

            // Draw crisp ring border around the circular avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            if (isCurrentActive) {
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2.8;
              ctx.stroke();
            } else if (isDimmed) {
              ctx.strokeStyle = "rgba(140, 145, 160, 0.3)";
              ctx.lineWidth = 1;
              ctx.stroke();
            } else {
              ctx.strokeStyle = node.color;
              ctx.lineWidth = node.isSelf ? 2.5 : 2;
              ctx.stroke();
            }
            ctx.restore();
          } else {
            // Default: show as it is dot
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

            if (isCurrentActive) {
              ctx.shadowColor = node.color;
              ctx.shadowBlur = 18;
              ctx.fillStyle = node.color;
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2.5;
              ctx.stroke();
            } else if (isDimmed) {
              ctx.fillStyle = "rgba(140, 145, 160, 0.25)";
              ctx.fill();
            } else {
              ctx.shadowColor = node.color;
              ctx.shadowBlur = node.isSelf ? 14 : node.isDirect ? 10 : 8;
              ctx.fillStyle = node.color;
              ctx.fill();

              if (node.isSelf) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            }
            ctx.restore();
          }

          // 3. Draw clean compact labels for nodes (self, direct friends, hovered/active, or when zoomed in)
          const shouldShowLabel =
            !isDimmed &&
            (node.isSelf || node.isDirect || isCurrentActive || zoom >= 1.35);

          if (shouldShowLabel) {
            ctx.save();
            ctx.font = node.isSelf
              ? "700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              : node.isDirect
              ? "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              : "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            const labelText = node.name;
            const textMetrics = ctx.measureText(labelText);
            const textWidth = textMetrics.width;
            const labelY = node.y + r + 6;

            // Dark translucent pill backing for crisp readability
            ctx.fillStyle = "rgba(12, 14, 20, 0.85)";
            ctx.fillRect(node.x - textWidth / 2 - 5, labelY - 2, textWidth + 10, 17);

            // Label text color matching node role
            ctx.fillStyle = isCurrentActive
              ? "#34d399"
              : node.isSelf
              ? "#ffffff"
              : node.isDirect
              ? "#a7f3d0"
              : "#bae6fd";
            ctx.fillText(labelText, node.x, labelY);
            ctx.restore();
          }
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [pan, zoom, draggedNode, hoveredNode, activeNode, avatarVersion]);

  // Coordinate conversion helper: client coordinate -> simulation coordinate
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = screenX - rect.left;
      const clientY = screenY - rect.top;
      const displayWidth = rect.width;
      const displayHeight = rect.height;

      const unscaledX = (clientX - (displayWidth / 2 + pan.x)) / zoom + displayWidth / 2;
      const unscaledY = (clientY - (displayHeight / 2 + pan.y)) / zoom + displayHeight / 2;
      return { x: unscaledX, y: unscaledY };
    },
    [pan, zoom],
  );

  // Find node under mouse
  const getNodeAt = useCallback(
    (screenX: number, screenY: number) => {
      const { x, y } = screenToWorld(screenX, screenY);
      const hitRadius = 20 / zoom;
      const nodes = simNodesRef.current;

      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (!n) continue;
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= (n.radius + hitRadius) * (n.radius + hitRadius)) {
          return n;
        }
      }
      return null;
    },
    [screenToWorld, zoom],
  );

  // Mouse / Pointer handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const hitNode = getNodeAt(e.clientX, e.clientY);

    if (hitNode) {
      hitNode.fx = hitNode.x;
      hitNode.fy = hitNode.y;
      setDraggedNode(hitNode);
      setActiveNode(hitNode);

      if (onSelectNode) {
        if (hitNode.isSelf) {
          onSelectNode({
            user_id: hitNode.id,
            display_name: selfName,
            depth: 0 as unknown as (1 | 2),
            card_count: 0,
            via_user_id: null,
            avatar_url: hitNode.avatarUrl || null,
          });
        } else {
          const orig = friends.find((f) => f.user_id === hitNode.id);
          if (orig) onSelectNode(orig);
        }
      }
    } else {
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...pan };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedNode) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      draggedNode.fx = x;
      draggedNode.fy = y;
      draggedNode.x = x;
      draggedNode.y = y;
    } else if (isDraggingCanvas) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
    } else {
      const hit = getNodeAt(e.clientX, e.clientY);
      setHoveredNode(hit ?? null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hit ? "pointer" : "grab";
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (draggedNode) {
      draggedNode.fx = null;
      draggedNode.fy = null;
      setDraggedNode(null);
    }
    setIsDraggingCanvas(false);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z * 0.8, 0.4));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActiveNode(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(Math.max(z * factor, 0.4), 3));
  };

  const hasConnections = friends.length > 0;

  return (
    <section className="network-constellation-card" ref={containerRef}>
      {/* Top Header & Interactive Toolbar */}
      <div className="constellation-header">
        <div className="constellation-titles">
          <div className="constellation-badge">
            <span className="pulsing-dot" />
            <span>Live Constellation Trust Map</span>
          </div>
          <h2 className="constellation-heading">Your Real Network & Friends of Friends</h2>
          <p className="constellation-desc">
            Visualizing your direct trusted connections and extended 2nd-degree friend network from database.
          </p>
        </div>

        <div className="constellation-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="toolbar-btn text-btn"
              onClick={handleResetView}
              title="Reset View"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="constellation-stage-wrap">
        <canvas
          ref={canvasRef}
          className="constellation-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        />

        {/* Legend Overlay */}
        <div className="constellation-legend">
          <div className="legend-item">
            <span className="legend-dot dot-white" />
            <span>You (Hub)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-green" />
            <span>Direct Friend</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
            <span>Friend of Friend</span>
          </div>
        </div>

        {/* Floating Node Details Card on Selection or Hover */}
        {(hoveredNode || activeNode) && (
          <div className="constellation-hover-card">
            <div className="hover-card-header">
              <span
                className="hover-card-avatar"
                style={{
                  background:
                    (hoveredNode || activeNode)?.color === "#10b981"
                      ? "rgba(16, 185, 129, 0.2)"
                      : (hoveredNode || activeNode)?.color === "#38bdf8"
                      ? "rgba(56, 189, 248, 0.2)"
                      : "rgba(255, 255, 255, 0.15)",
                  color: (hoveredNode || activeNode)?.color,
                }}
              >
                {((hoveredNode || activeNode)?.fullName || (hoveredNode || activeNode)?.name || "").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{(hoveredNode || activeNode)?.fullName || (hoveredNode || activeNode)?.name}</strong>
                <span className="hover-card-role">
                  {(hoveredNode || activeNode)?.isSelf
                    ? "Your Root Profile Node"
                    : (hoveredNode || activeNode)?.depth === 1
                    ? "✓ Direct Trusted Friend"
                    : "✨ Friend of Friend (2nd Degree)"}
                </span>
              </div>
            </div>
            {!(hoveredNode || activeNode)?.isSelf && (
              <div className="hover-card-meta">
                <span>
                  💳 <strong>{(hoveredNode || activeNode)?.cardCount}</strong> card
                  {(hoveredNode || activeNode)?.cardCount === 1 ? "" : "s"} shared
                </span>
                {(hoveredNode || activeNode)?.viaUserId && (
                  <span className="via-text">🌱 Connected via mutual friend</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state banner if 0 friends */}
        {!hasConnections && (
          <div className="constellation-empty-overlay">
            <div className="empty-content-box">
              <div className="empty-icon">👥</div>
              <h3>No Friends in Graph Yet</h3>
              <p>
                Search for friends by name above to send connection invites. As soon as you connect, your constellation graph will blossom with direct friends and friends-of-friends!
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="constellation-footer">
        <span className="interaction-tip">
          💡 Click and drag any node to explore physics · Scroll or pinch to zoom
        </span>
        <span className="nodes-counter">
          {friends.length + 1} live network nodes
        </span>
      </div>
    </section>
  );
}
