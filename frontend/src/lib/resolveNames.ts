import { supabase } from "./supabaseClient";

const profileCache = new Map<string, Promise<{ display_name: string; avatar_url: string | null }>>();

async function resolveUserProfile(userId: string): Promise<{ display_name: string; avatar_url: string | null }> {
  if (profileCache.has(userId)) {
    return profileCache.get(userId)!;
  }

  const promise = (async () => {
    try {
      const { data } = await supabase.from("profiles_public").select("display_name, avatar_url").eq("id", userId).single();
      if (data?.display_name) {
        return {
          display_name: data.display_name,
          avatar_url: data.avatar_url ?? null,
        };
      }
    } catch {
      // ignore
    }

    try {
      const token = localStorage.getItem("cardcrew_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:3000/users/${encodeURIComponent(userId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.user?.display_name) {
          return {
            display_name: data.user.display_name,
            avatar_url: data.user.avatar_url ?? null,
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      display_name: "User " + userId.slice(0, 6),
      avatar_url: null,
    };
  })();

  profileCache.set(userId, promise);
  return promise;
}

async function resolveDisplayName(userId: string): Promise<string> {
  const profile = await resolveUserProfile(userId);
  return profile.display_name;
}

async function resolveDisplayNames<T extends { user_id: string }>(
  items: T[],
): Promise<Array<T & { display_name: string }>> {
  return Promise.all(
    items.map(async (item) => ({ ...item, display_name: await resolveDisplayName(item.user_id) })),
  );
}

export { resolveDisplayName, resolveDisplayNames, resolveUserProfile };
