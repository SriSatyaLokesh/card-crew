import { expect, test } from "@playwright/test";

import { createTestUser } from "../src/helpers.js";
import { signIn } from "../src/ui.js";

test("user A invites user B by id, B accepts, both see the direct friend", async ({ browser }) => {
  const userA = await createTestUser("Alice Network");
  const userB = await createTestUser("Bob Network");

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signIn(pageA, userA);
  await pageA.goto("/network");
  await pageA.getByLabel("Invite by user ID").fill(userB.id);
  await pageA.getByRole("button", { name: "Send invite" }).click();
  await expect(pageA.getByText("Invite sent.")).toBeVisible();

  await signIn(pageB, userB);
  await pageB.goto("/network");
  const incomingRow = pageB.locator("li").filter({ hasText: userA.displayName });
  await expect(incomingRow).toBeVisible();
  await incomingRow.getByRole("button", { name: "Accept" }).click();
  await expect(pageB.getByText("Connection accepted.")).toBeVisible();

  await expect(pageB.locator("li").filter({ hasText: userA.displayName }).filter({ hasText: "Direct friend" })).toBeVisible();

  await pageA.goto("/network");
  await expect(pageA.locator("li").filter({ hasText: userB.displayName }).filter({ hasText: "Direct friend" })).toBeVisible();

  await contextA.close();
  await contextB.close();
});
