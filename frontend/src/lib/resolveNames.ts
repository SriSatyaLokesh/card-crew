import { api } from "./apiClient";

async function resolveDisplayName(userId: string): Promise<string> {
  try {
    const { user } = await api.getUserProfile(userId);
    return user.display_name;
  } catch {
    return "Unknown user";
  }
}

async function resolveDisplayNames<T extends { user_id: string }>(
  items: T[],
): Promise<Array<T & { display_name: string }>> {
  return Promise.all(
    items.map(async (item) => ({ ...item, display_name: await resolveDisplayName(item.user_id) })),
  );
}

export { resolveDisplayName, resolveDisplayNames };
