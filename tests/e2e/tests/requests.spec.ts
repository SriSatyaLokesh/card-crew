import { expect, test } from "@playwright/test";

import { addResource, becomeFriends, createTestUser, setPhone, uniquePhone } from "../src/helpers.js";
import { signIn } from "../src/ui.js";

test("B requests A's card, A approves, B reveals contact", async ({ browser }) => {
  const owner = await createTestUser("Card Owner Requests");
  const requester = await createTestUser("Requester Person");
  await becomeFriends(owner, requester);
  await addResource(owner, "Infinia", "hdfc");
  await setPhone(owner, uniquePhone());

  const contextOwner = await browser.newContext();
  const contextRequester = await browser.newContext();
  const pageOwner = await contextOwner.newPage();
  const pageRequester = await contextRequester.newPage();

  // Requester searches the network and sends a request from the home page.
  await signIn(pageRequester, requester);
  await pageRequester.getByPlaceholder("Search a card...").fill("Infinia");
  await pageRequester.getByRole("button").filter({ hasText: "Infinia" }).first().click();

  const matchRow = pageRequester.locator(".match-list li").filter({ hasText: owner.displayName });
  await expect(matchRow).toBeVisible();
  await matchRow.getByRole("button", { name: "Request help" }).click();
  await pageRequester.getByRole("button", { name: "Send request" }).click();
  await expect(matchRow.getByText("Request sent")).toBeVisible();

  // Owner approves it from the requests inbox.
  await signIn(pageOwner, owner);
  await pageOwner.goto("/requests");
  const incomingRow = pageOwner.locator(".request-list li").filter({ hasText: requester.displayName });
  await expect(incomingRow).toBeVisible();
  await incomingRow.getByRole("button", { name: "Approve" }).click();
  await expect(incomingRow.getByText("approved", { exact: true })).toBeVisible();

  // Requester reveals contact once approved.
  await pageRequester.goto("/requests");
  await pageRequester.getByRole("button", { name: "Outgoing" }).click();
  const outgoingRow = pageRequester.locator(".request-list li").filter({ hasText: owner.displayName });
  await expect(outgoingRow).toBeVisible();
  await outgoingRow.getByRole("button", { name: "Prepare contact handoff" }).click();
  await expect(outgoingRow.getByText(`Contact details available: ${owner.displayName}`)).toBeVisible();
  await expect(outgoingRow.getByRole("link", { name: "Open WhatsApp with message" })).toBeVisible();

  await contextOwner.close();
  await contextRequester.close();
});
