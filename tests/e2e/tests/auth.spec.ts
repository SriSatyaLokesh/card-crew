import { expect, test } from "@playwright/test";

import { TEST_PASSWORD } from "../src/helpers.js";

test.describe("auth", () => {
  test("signs up through the real form, lands on the search page", async ({ page }) => {
    const email = `e2e-signup-${Date.now()}@card-crew.test`;
    const displayName = "E2E Signup User";

    await page.goto("/login");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Find help from people you trust")).toBeVisible();
    await expect(page.getByText(displayName)).toBeVisible();
  });

  test("visiting a protected route while signed out redirects to /login", async ({ page }) => {
    await page.goto("/cards");
    await expect(page).toHaveURL("/login");
  });
});
