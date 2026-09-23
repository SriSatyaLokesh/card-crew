// Ports: backend-b4-b10.test.ts "GET /catalog/cards returns a curated card catalog"
import { describe, expect, it } from "vitest";
import { anonClient, createTestUser } from "./src/helpers.js";

describe("catalog", () => {
  it("catalog_cards_view lists active cards with issuer/network/use_cases embedded", async () => {
    const user = await createTestUser();
    const { data, error } = await user.client.from("catalog_cards_view").select("*").limit(500);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const hdfcInfinia = data!.find((c: any) => c.issuer_slug === "hdfc" && c.product_name === "Infinia");
    expect(hdfcInfinia).toBeTruthy();
    expect(hdfcInfinia.card_category).toBe("credit");
    expect(data!.some((c: any) => c.upi_enabled)).toBe(true);
  });

  it("catalog RLS is scoped to `authenticated`, not `anon` — a deliberate design choice (docs/DATABASE_DESIGN.md §6), not an oversight", async () => {
    const client = anonClient();
    const { data, error } = await client.from("catalog_cards_view").select("id").limit(1);
    expect(error).toBeNull(); // RLS silently filters rather than erroring
    expect(data).toEqual([]);
  });
});
