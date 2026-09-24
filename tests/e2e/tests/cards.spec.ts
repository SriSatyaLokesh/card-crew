import { expect, test } from "@playwright/test";

import { createTestUser } from "../src/helpers.js";
import { signIn } from "../src/ui.js";

test("add a card, toggle requests, remove it", async ({ page }) => {
  const owner = await createTestUser("Card Owner");
  await signIn(page, owner);
  await page.goto("/cards");

  await page.getByPlaceholder("Search the catalog...").fill("Infinia");
  await page.getByRole("listitem").filter({ hasText: "Infinia" }).getByRole("button", { name: "Choose" }).click();
  await expect(page.getByText("Selected card")).toBeVisible();

  await page.getByRole("button", { name: "Save to My Cards" }).click();
  await expect(page.getByText("added.")).toBeVisible();

  const savedCard = page.locator(".saved-card-grid li").filter({ hasText: "Infinia" });
  await expect(savedCard).toBeVisible();

  // A custom CSS toggle switch sits visually on top of the real checkbox input, so click
  // the label (standard <label><input/><span class="switch"/></label> pattern) instead of
  // the input directly -- the input intercepts nothing, the decorative span does.
  const requestsToggle = savedCard.getByRole("checkbox");
  const requestsLabel = savedCard.locator(".checkbox-label");
  await expect(requestsToggle).toBeChecked();
  await requestsLabel.click();
  await expect(requestsToggle).not.toBeChecked();

  page.once("dialog", (dialog) => dialog.accept());
  await savedCard.getByRole("button", { name: "Remove card" }).click();
  await expect(page.getByText("Card removed.")).toBeVisible();
  await expect(page.locator(".saved-card-grid li").filter({ hasText: "Infinia" })).toHaveCount(0);
});
