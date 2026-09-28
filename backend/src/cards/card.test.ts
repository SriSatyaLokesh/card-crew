import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import type { RequestHandler } from "express";

import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../users/user.repository.js";
import { UserService } from "../users/user.service.js";
import { InMemoryConnectionRepository } from "../connections/connection.repository.js";
import { ConnectionService } from "../connections/connection.service.js";
import { InMemoryCardRepository } from "./card.repository.js";
import { CardService } from "./card.service.js";

let server: http.Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = undefined;
});

function createTestApp() {
  const userRepository = new InMemoryUserRepository();
  const cardRepository = new InMemoryCardRepository();
  const cardService = new CardService({ cardRepository, userRepository });
  const userService = new UserService({ userRepository });
  const connectionService = new ConnectionService({
    connectionRepository: new InMemoryConnectionRepository(),
    userRepository,
  });

  const userAuthMiddleware: RequestHandler = (_req, _res, next) => next();
  const optionalUserAuthMiddleware: RequestHandler = (req, _res, next) => {
    if (req.headers.authorization) {
      req.authUserId = req.headers.authorization.replace("Bearer ", "");
    }
    next();
  };

  const app = createApp({
    userService,
    connectionService,
    cardService,
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });

  return { app, userRepository, cardRepository };
}

test("Card management lifecycle: create, list, update, and delete", async () => {
  const { app, userRepository } = createTestApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server?.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const user1 = await userRepository.upsertProfile({
    id: "user-1",
    email: "user1@example.com",
    display_name: "User One",
    status: "active",
  });
  const user2 = await userRepository.upsertProfile({
    id: "user-2",
    email: "user2@example.com",
    display_name: "User Two",
    status: "active",
  });

  // 1. Validation errors on create
  const emptyNameRes = await fetch(`${baseUrl}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user1.id}` },
    body: JSON.stringify({ cardName: "  ", cardType: "Credit Card" }),
  });
  assert.equal(emptyNameRes.status, 400);

  const invalidTypeRes = await fetch(`${baseUrl}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user1.id}` },
    body: JSON.stringify({ cardName: "HDFC Regalia", cardType: "Crypto Card" }),
  });
  assert.equal(invalidTypeRes.status, 400);

  // 2. Successful creation with ONLY cardName and cardType
  const createRes = await fetch(`${baseUrl}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user1.id}` },
    body: JSON.stringify({ cardName: "HDFC Regalia", cardType: "Credit Card" }),
  });
  assert.equal(createRes.status, 201);
  const createdBody = (await createRes.json()) as { card: { id: string; cardName: string; cardType: string; userId: string } };
  assert.equal(createdBody.card.cardName, "HDFC Regalia");
  assert.equal(createdBody.card.cardType, "Credit Card");
  assert.equal(createdBody.card.userId, user1.id);
  const cardId = createdBody.card.id;

  // Add a second card (Debit Card)
  const createRes2 = await fetch(`${baseUrl}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user1.id}` },
    body: JSON.stringify({ cardName: "SBI SimplySAVE", cardType: "debit card" }),
  });
  assert.equal(createRes2.status, 201);
  const createdBody2 = (await createRes2.json()) as { card: { cardType: string } };
  assert.equal(createdBody2.card.cardType, "Debit Card");

  // 3. List cards returns only the user's cards
  const listRes1 = await fetch(`${baseUrl}/cards`, {
    headers: { Authorization: `Bearer ${user1.id}` },
  });
  assert.equal(listRes1.status, 200);
  const listBody1 = (await listRes1.json()) as { cards: Array<{ cardName: string }> };
  assert.equal(listBody1.cards.length, 2);

  const listRes2 = await fetch(`${baseUrl}/cards`, {
    headers: { Authorization: `Bearer ${user2.id}` },
  });
  assert.equal(listRes2.status, 200);
  const listBody2 = (await listRes2.json()) as { cards: Array<unknown> };
  assert.equal(listBody2.cards.length, 0);

  // 4. Update card: only cardName and cardType
  const updateRes = await fetch(`${baseUrl}/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user1.id}` },
    body: JSON.stringify({ cardName: "HDFC Regalia Gold", cardType: "Credit Card" }),
  });
  assert.equal(updateRes.status, 200);
  const updatedBody = (await updateRes.json()) as { card: { cardName: string } };
  assert.equal(updatedBody.card.cardName, "HDFC Regalia Gold");

  // Unauthorized update attempt by user2
  const unauthUpdateRes = await fetch(`${baseUrl}/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user2.id}` },
    body: JSON.stringify({ cardName: "Hacked Card" }),
  });
  assert.equal(unauthUpdateRes.status, 403);

  // 5. Unauthorized delete attempt by user2
  const unauthDeleteRes = await fetch(`${baseUrl}/cards/${cardId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${user2.id}` },
  });
  assert.equal(unauthDeleteRes.status, 403);

  // 6. Authorized delete by user1
  const deleteRes = await fetch(`${baseUrl}/cards/${cardId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${user1.id}` },
  });
  assert.equal(deleteRes.status, 204);

  // Check remaining count
  const listAfterDelete = await fetch(`${baseUrl}/cards`, {
    headers: { Authorization: `Bearer ${user1.id}` },
  });
  const listAfterBody = (await listAfterDelete.json()) as { cards: Array<unknown> };
  assert.equal(listAfterBody.cards.length, 1);
});
