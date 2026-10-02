import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { ChatMessage, ChatSummary, UserPresence } from "../types/api";

export class ChatError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ChatError";
  }
}

function unwrap<T>({ data, error }: { data: T | null; error: PostgrestError | null }): T {
  if (error) {
    throw new ChatError(500, error.message);
  }
  return data as T;
}

/**
 * Retrieves all conversations for the authenticated user, ordered by last activity.
 */
export async function getUserChats(): Promise<ChatSummary[]> {
  const res = await supabase.rpc("get_user_chats");
  return (unwrap(res) as ChatSummary[]) || [];
}

/**
 * Safely retrieves an existing 1-on-1 direct chat or creates a new one atomically.
 */
export async function getOrCreateDirectChat(otherUserId: string): Promise<string> {
  const res = await supabase.rpc("get_or_create_direct_chat", { p_other_user_id: otherUserId });
  return unwrap(res) as string;
}

/**
 * Loads messages for a given chat with cursor-based pagination.
 * Messages are returned in chronological order (oldest -> newest).
 */
export async function getChatMessages(
  chatId: string,
  limit = 40,
  beforeCreatedAt?: string,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) {
    query = query.lt("created_at", beforeCreatedAt);
  }

  const res = await query;
  const rows = (unwrap(res) as ChatMessage[]) || [];
  const hasMore = rows.length === limit;
  // Reverse to display chronologically in the chat window
  const messages = [...rows].reverse();

  return { messages, hasMore };
}

/**
 * Sends a message in a conversation. Status defaults to 'sent'.
 */
export async function sendMessage(chatId: string, content: string): Promise<ChatMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new ChatError(400, "Message content cannot be empty");
  }

  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) {
    throw new ChatError(401, "Not authenticated");
  }

  const res = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      sender_id: userId,
      content: trimmed,
      message_type: "text",
      status: "sent",
    })
    .select()
    .single();

  // Bump the chat's updated_at timestamp
  await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);

  return unwrap(res) as ChatMessage;
}

/**
 * Marks messages in the chat as seen and updates last_read_at timestamp.
 */
export async function markChatAsRead(chatId: string): Promise<void> {
  const res = await supabase.rpc("mark_chat_as_read", { p_chat_id: chatId });
  unwrap(res);
}

/**
 * Marks incoming messages as delivered when received by the other participant.
 */
export async function markMessagesDelivered(chatId: string): Promise<void> {
  const res = await supabase.rpc("mark_messages_delivered", { p_chat_id: chatId });
  unwrap(res);
}

/**
 * Fetches persisted presence / last-seen info for a user.
 */
export async function getUserPresence(userId: string): Promise<UserPresence | null> {
  const res = await supabase
    .from("user_presence")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return res.data as UserPresence | null;
}

/**
 * Persists the current user's last_seen_at in PostgreSQL.
 */
export async function updateUserLastSeen(): Promise<void> {
  try {
    await supabase.rpc("update_user_last_seen");
  } catch {
    // ignore
  }
}

/**
 * Subscribes to real-time message events (INSERT, UPDATE) scoped to a specific chat_id.
 * Returns an unsubscribe cleanup callback.
 */
export function subscribeToChat(
  chatId: string,
  callbacks: {
    onNewMessage: (msg: ChatMessage) => void;
    onMessageUpdated: (msg: ChatMessage) => void;
  },
): () => void {
  const channelName = `chat_room:${chatId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        callbacks.onNewMessage(payload.new as ChatMessage);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        callbacks.onMessageUpdated(payload.new as ChatMessage);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribes to global Realtime Presence to track which users are currently online.
 * Returns an unsubscribe cleanup callback.
 */
export function subscribeToOnlinePresence(
  currentUserId: string,
  onSync: (onlineUserIds: Set<string>) => void,
): () => void {
  const channel = supabase.channel("online_presence_room", {
    config: {
      presence: {
        key: currentUserId,
      },
    },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineSet = new Set<string>();
      for (const key of Object.keys(state)) {
        onlineSet.add(key);
      }
      onSync(onlineSet);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        });
        await updateUserLastSeen();
      }
    });

  return () => {
    channel.untrack().catch(() => {});
    supabase.removeChannel(channel);
    updateUserLastSeen().catch(() => {});
  };
}
