import { supabase } from "./supabaseClient";

async function resolveDisplayName(userId: string): Promise<string> {
  const { data } = await supabase.from("profiles_public").select("display_name").eq("id", userId).single();
  return data?.display_name ?? "Unknown user";
}

async function resolveUserProfile(userId: string): Promise<{ display_name: string; avatar_url: string | null }> {
  const { data } = await supabase.from("profiles_public").select("display_name, avatar_url").eq("id", userId).single();
  return {
    display_name: data?.display_name ?? "Unknown user",
    avatar_url: data?.avatar_url ?? null,
  };
}

async function resolveDisplayNames<T extends { user_id: string }>(
  items: T[],
): Promise<Array<T & { display_name: string }>> {
  return Promise.all(
    items.map(async (item) => ({ ...item, display_name: await resolveDisplayName(item.user_id) })),
  );
}

export { resolveDisplayName, resolveUserProfile, resolveDisplayNames };
