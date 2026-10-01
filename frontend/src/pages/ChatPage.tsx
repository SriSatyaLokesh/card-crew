import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/apiClient";
import type { ChatMessage, ChatSummary, UserPresence, SearchUserSummary } from "../types/api";
import "./ChatPage.css";

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffHours < 48) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(lastSeenAt?: string | null, isOnline?: boolean): string {
  if (isOnline) return "Online";
  if (!lastSeenAt) return "Offline";
  const d = new Date(lastSeenAt);
  const diffMinutes = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return "Last seen just now";
  if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  return `Last seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export function ChatPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetChatIdFromUrl = searchParams.get("chat");
  const targetUserFromUrl = searchParams.get("user");

  // State
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(targetChatIdFromUrl);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [otherPresence, setOtherPresence] = useState<UserPresence | null>(null);

  // New Chat Modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [candidateUsers, setCandidateUsers] = useState<SearchUserSummary[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Active chat metadata
  const activeChat = useMemo(() => {
    return chats.find((c) => c.chat_id === activeChatId) || null;
  }, [chats, activeChatId]);

  // 1. Subscribe to online presence
  useEffect(() => {
    if (!profile) return;
    const unsub = api.subscribeToOnlinePresence(profile.id, (onlineSet) => {
      setOnlineUserIds(onlineSet);
    });
    return () => unsub();
  }, [profile]);

  // 2. Load conversations
  async function loadChats() {
    try {
      const chatList = await api.getUserChats();
      setChats(chatList);
      return chatList;
    } catch (err) {
      console.error("Failed to load chats:", err);
      return [];
    } finally {
      setLoadingChats(false);
    }
  }

  useEffect(() => {
    loadChats();
  }, [profile]);

  // 3. Handle target user from URL (?user=...)
  useEffect(() => {
    if (!targetUserFromUrl || !profile) return;
    (async () => {
      try {
        const chatId = await api.getOrCreateDirectChat(targetUserFromUrl);
        setActiveChatId(chatId);
        setSearchParams({ chat: chatId }, { replace: true });
        await loadChats();
      } catch (err) {
        console.error("Failed to open direct chat with user:", err);
      }
    })();
  }, [targetUserFromUrl, profile]);

  // 4. Load messages when activeChatId changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);

    (async () => {
      try {
        const { messages: msgs, hasMore } = await api.getChatMessages(activeChatId, 40);
        if (!isMounted) return;
        setMessages(msgs);
        setHasMoreMessages(hasMore);

        // Mark incoming messages as read/delivered
        await api.markChatAsRead(activeChatId);
        // Refresh chat list unread counts
        loadChats();
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeChatId]);

  // 5. Fetch other user presence / last seen
  useEffect(() => {
    if (!activeChat) {
      setOtherPresence(null);
      return;
    }
    api.getUserPresence(activeChat.other_user_id).then(setOtherPresence).catch(() => {});
  }, [activeChat]);

  // 6. Realtime messages subscription scoped to activeChatId
  useEffect(() => {
    if (!activeChatId || !profile) return;

    // Mark any pending delivered status
    api.markMessagesDelivered(activeChatId).catch(() => {});

    const unsubscribe = api.subscribeToChat(activeChatId, {
      onNewMessage: (newMsg) => {
        setMessages((prev) => {
          // Avoid duplicate insertion
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // If message is from other user and chat is open, immediately mark as read
        if (newMsg.sender_id !== profile.id) {
          api.markChatAsRead(activeChatId).catch(() => {});
        }

        // Update conversation list snippet
        setChats((prev) =>
          prev.map((c) =>
            c.chat_id === activeChatId
              ? {
                  ...c,
                  last_message_content: newMsg.content,
                  last_message_created_at: newMsg.created_at,
                  last_message_status: newMsg.status,
                  last_message_sender_id: newMsg.sender_id,
                  unread_count: 0,
                }
              : c,
          ),
        );
      },
      onMessageUpdated: (updatedMsg) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)),
        );

        // Update last message status in sidebar if matched
        setChats((prev) =>
          prev.map((c) =>
            c.chat_id === activeChatId && c.last_message_id === updatedMsg.id
              ? { ...c, last_message_status: updatedMsg.status }
              : c,
          ),
        );
      },
    });

    return () => {
      unsubscribe();
    };
  }, [activeChatId, profile]);

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, loadingMessages]);

  // Load older messages (cursor pagination)
  async function handleLoadMore() {
    if (!activeChatId || loadingMore || !hasMoreMessages || messages.length === 0) return;
    setLoadingMore(true);
    const oldestTimestamp = messages[0]?.created_at;
    if (!oldestTimestamp) {
      setLoadingMore(false);
      return;
    }

    try {
      const { messages: older, hasMore } = await api.getChatMessages(
        activeChatId,
        40,
        oldestTimestamp,
      );
      setMessages((prev) => [...older, ...prev]);
      setHasMoreMessages(hasMore);
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  // Send message handler
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = newMessageText.trim();
    if (!text || !activeChatId || !profile || isSending) return;

    setNewMessageText("");
    setIsSending(true);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      chat_id: activeChatId,
      sender_id: profile.id,
      content: text,
      message_type: "text",
      status: "sent",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const realMsg = await api.sendMessage(activeChatId, text);
      // Replace optimistic message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? realMsg : m)),
      );

      // Update sidebar
      setChats((prev) =>
        prev.map((c) =>
          c.chat_id === activeChatId
            ? {
                ...c,
                last_message_content: text,
                last_message_created_at: realMsg.created_at,
                last_message_status: "sent",
                last_message_sender_id: profile.id,
              }
            : c,
        ),
      );
    } catch (err) {
      console.error("Send failed:", err);
      // Remove optimistic or show error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  // Start new chat with user from candidate list
  async function handleSelectUserForChat(otherUserId: string) {
    setIsNewChatModalOpen(false);
    try {
      const chatId = await api.getOrCreateDirectChat(otherUserId);
      setActiveChatId(chatId);
      setSearchParams({ chat: chatId });
      await loadChats();
    } catch (err) {
      console.error("Failed to start chat:", err);
      alert("Could not start conversation with user.");
    }
  }

  // Search users for new chat modal
  useEffect(() => {
    if (!isNewChatModalOpen) return;
    setSearchingCandidates(true);
    const query = candidateSearch.trim();

    const t = setTimeout(async () => {
      try {
        const { users } = await api.searchUsers(query || "a");
        setCandidateUsers(users.filter((u) => u.id !== profile?.id));
      } catch {
        setCandidateUsers([]);
      } finally {
        setSearchingCandidates(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [candidateSearch, isNewChatModalOpen, profile]);

  const isOtherOnline = Boolean(activeChat && onlineUserIds.has(activeChat.other_user_id));

  return (
    <div className="chat-layout-container">
      {/* ── 1. Left Sidebar: Conversations List ── */}
      <aside className={`chat-sidebar ${activeChatId ? "hidden-mobile" : ""}`}>
        <div className="chat-sidebar-header">
          <div className="chat-sidebar-title-row">
            <h2>Messages</h2>
            <button
              type="button"
              className="button-primary-accent btn-sm"
              onClick={() => {
                setCandidateSearch("");
                setIsNewChatModalOpen(true);
              }}
              title="Start a new conversation"
            >
              + New Chat
            </button>
          </div>
        </div>

        <div className="chat-conversations-list">
          {loadingChats ? (
            <div className="chat-loading-state">Loading conversations...</div>
          ) : chats.length === 0 ? (
            <div className="chat-empty-sidebar">
              <span className="empty-chat-icon" aria-hidden="true">💬</span>
              <p>No conversations yet.</p>
              <button
                type="button"
                className="button-secondary btn-sm"
                onClick={() => setIsNewChatModalOpen(true)}
              >
                Find connections to message
              </button>
            </div>
          ) : (
            chats.map((c) => {
              const isSelected = c.chat_id === activeChatId;
              const isOnline = onlineUserIds.has(c.other_user_id);
              const isOwnMessage = c.last_message_sender_id === profile?.id;

              return (
                <div
                  key={c.chat_id}
                  className={`chat-thread-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    setActiveChatId(c.chat_id);
                    setSearchParams({ chat: c.chat_id });
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="chat-avatar-wrapper">
                    {c.other_user_avatar_url ? (
                      <img
                        src={c.other_user_avatar_url}
                        alt=""
                        className="chat-avatar-img"
                      />
                    ) : (
                      <div className="chat-avatar-fallback">
                        {c.other_user_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isOnline && <span className="online-presence-dot" title="Online" />}
                  </div>

                  <div className="chat-thread-meta">
                    <div className="chat-thread-topline">
                      <strong className="chat-thread-name">{c.other_user_name}</strong>
                      <span className="chat-thread-time">
                        {formatRelativeTime(c.last_message_created_at || c.updated_at)}
                      </span>
                    </div>

                    <div className="chat-thread-bottomline">
                      <span className="chat-thread-snippet">
                        {isOwnMessage && (
                          <span
                            className={`msg-status-icon status-${c.last_message_status || "sent"}`}
                            title={c.last_message_status || "sent"}
                          >
                            {c.last_message_status === "seen"
                              ? "✓✓"
                              : c.last_message_status === "delivered"
                              ? "✓✓"
                              : "✓"}{" "}
                          </span>
                        )}
                        {c.last_message_content || "No messages yet"}
                      </span>

                      {c.unread_count > 0 && (
                        <span className="chat-unread-badge">{c.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── 2. Right Panel: Active Chat Stream ── */}
      <section className={`chat-main-window ${!activeChatId ? "hidden-mobile" : ""}`}>
        {!activeChat ? (
          <div className="chat-empty-window">
            <div className="chat-empty-graphic" aria-hidden="true">💬</div>
            <h3>Your Messages</h3>
            <p>Send private messages, check credit card offers, and connect with your network in real time.</p>
            <button
              type="button"
              className="button-primary-accent"
              onClick={() => setIsNewChatModalOpen(true)}
            >
              Start a Conversation
            </button>
          </div>
        ) : (
          <div className="chat-active-container">
            {/* Header */}
            <div className="chat-active-header">
              <button
                type="button"
                className="chat-back-mobile-btn"
                onClick={() => {
                  setActiveChatId(null);
                  setSearchParams({});
                }}
                title="Back to conversations"
              >
                ←
              </button>

              <div className="chat-header-avatar">
                {activeChat.other_user_avatar_url ? (
                  <img
                    src={activeChat.other_user_avatar_url}
                    alt=""
                    className="chat-avatar-img"
                  />
                ) : (
                  <div className="chat-avatar-fallback">
                    {activeChat.other_user_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {isOtherOnline && <span className="online-presence-dot" />}
              </div>

              <div className="chat-header-info">
                <strong className="chat-header-name">{activeChat.other_user_name}</strong>
                <span className={`chat-header-presence ${isOtherOnline ? "is-online" : ""}`}>
                  {formatLastSeen(otherPresence?.last_seen_at, isOtherOnline)}
                </span>
              </div>
            </div>

            {/* Messages Body */}
            <div className="chat-messages-body" ref={messagesContainerRef}>
              {hasMoreMessages && (
                <div className="chat-load-more-wrap">
                  <button
                    type="button"
                    className="button-secondary btn-sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "↑ Load earlier messages"}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="chat-messages-loading">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="chat-first-message-prompt">
                  <span className="first-msg-icon" aria-hidden="true">👋</span>
                  <h4>Say hello to {activeChat.other_user_name}!</h4>
                  <p>Send a message to kick off your conversation.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === profile?.id;

                  return (
                    <div
                      key={msg.id}
                      className={`chat-bubble-row ${isMine ? "outgoing" : "incoming"}`}
                    >
                      <div className={`chat-bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}>
                        <div className="bubble-text">{msg.content}</div>
                        <div className="bubble-footer">
                          <span className="bubble-time">{formatMessageTime(msg.created_at)}</span>
                          {isMine && (
                            <span
                              className={`bubble-status status-${msg.status}`}
                              title={`Status: ${msg.status}`}
                            >
                              {msg.status === "seen" ? (
                                <span className="check-seen">✓✓</span>
                              ) : msg.status === "delivered" ? (
                                <span className="check-delivered">✓✓</span>
                              ) : (
                                <span className="check-sent">✓</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chat-text-input"
                placeholder="Type a message..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!newMessageText.trim() || isSending}
                title="Send message (Enter)"
              >
                {isSending ? "..." : "Send ➤"}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* ── 3. Start New Chat Modal ── */}
      {isNewChatModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewChatModalOpen(false)}>
          <div
            className="modal-content new-chat-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h3>Start a New Message</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsNewChatModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <input
                type="search"
                className="network-search-input"
                placeholder="Search people by name..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                autoFocus
                style={{ width: "100%", marginBottom: "1rem" }}
              />

              <div className="candidate-users-list">
                {searchingCandidates ? (
                  <p className="chat-loading-state">Searching users...</p>
                ) : candidateUsers.length === 0 ? (
                  <p className="empty-state">No users found. Try searching another name.</p>
                ) : (
                  candidateUsers.map((user) => (
                    <div
                      key={user.id}
                      className="candidate-user-item"
                      onClick={() => handleSelectUserForChat(user.id)}
                    >
                      <div className="candidate-avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" />
                        ) : (
                          user.display_name.slice(0, 2).toUpperCase()
                        )}
                        {onlineUserIds.has(user.id) && <span className="online-presence-dot" />}
                      </div>

                      <div className="candidate-info">
                        <strong>{user.display_name}</strong>
                        <span className="candidate-subtext">
                          {onlineUserIds.has(user.id) ? "🟢 Online" : "Direct Connection"}
                        </span>
                      </div>

                      <button type="button" className="button-primary-accent btn-sm">
                        Chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
