// Shared page-level actions -- real UI interaction, reused across spec files so each test
// doesn't re-derive the same locators for signing in.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { TestUser } from "./helpers.js";

/** Signs in an already-created fixture user through the real login form. */
export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Scoped to the nav bar: the same display name also appears as an SVG label in the
  // network graph on the home page, which would otherwise make this locator ambiguous.
  await expect(page.locator(".nav-user-name")).toHaveText(user.displayName);
}
