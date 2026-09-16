import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import type { RequestHandler } from "express";

import { createApp } from "./app.js";
import { InMemoryCardCatalogRepository } from "./catalog/card-catalog.repository.js";
import { ConnectionService } from "./connections/connection.service.js";
import { InMemoryConnectionRepository } from "./connections/connection.repository.js";
import { InMemoryUserRepository } from "./users/user.repository.js";
import { UserService } from "./users/user.service.js";
import { InMemoryResourceRepository } from "./resources/resource.repository.js";
import { ResourceService } from "./resources/resource.service.js";
import { RequestService } from "./requests/request.service.js";
import { InMemoryRequestRepository } from "./requests/request.repository.js";

let server: http.Server | undefined;

afterEach(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = undefined;
});

function createTestAppWithRepositories({
  userRepository = new InMemoryUserRepository(),
  cardCatalogRepository = new InMemoryCardCatalogRepository(),
  resourceRepository = new InMemoryResourceRepository(),
  connectionRepository = new InMemoryConnectionRepository(),
  requestRepository = new InMemoryRequestRepository(),
} = {}) {
  const userAuthMiddleware: RequestHandler = (_request, _response, next) => next();
  const optionalUserAuthMiddleware: RequestHandler = (_request, _response, next) => next();

  const userService = new UserService({ userRepository });
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const resourceService = new ResourceService({ resourceRepository, userRepository, cardCatalogRepository, connectionRepository });
  const requestService = new RequestService({ requestRepository, userRepository, resourceRepository, connectionRepository });

  return createApp({
    userService,
    connectionService,
    catalogRepository: cardCatalogRepository,
    resourceService,
    requestService,
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });
}

function createTestApp() {
  return createTestAppWithRepositories();
}

async function registerUser(userRepository: InMemoryUserRepository, email: string, displayName: string) {
  const user = await userRepository.upsertProfile({
    id: `supabase-${email}`,
    email,
    display_name: displayName,
    status: "active",
  });

  return user.id;
}

test("GET /catalog/cards returns a curated card catalog", async () => {
  server = http.createServer(createTestApp());
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/catalog/cards`);

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    cards: Array<{
      id: string;
      issuer: string;
      product_name: string;
      card_category: string;
      upi_enabled: boolean;
    }>;
  };
  assert.ok(body.cards.length > 0);
  assert.equal(body.cards[0]?.issuer, "HDFC");
  assert.equal(body.cards[0]?.card_category, "credit");
  assert.ok(body.cards.some((card) => card.upi_enabled));
});

test("POST /resources and GET /resources list the owner's cards", async () => {
  const userRepository = new InMemoryUserRepository();
  server = http.createServer(createTestAppWithRepositories({ userRepository }));
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const ownerId = await registerUser(userRepository, "owner@example.com", "Owner");

  const createResponse = await fetch(`http://127.0.0.1:${port}/resources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner_id: ownerId,
      card_catalog_id: "hdfc-infinia",
      visibility: "friends",
      request_enabled: true,
      notes: "For travel perks",
    }),
  });

  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { resource: { owner_id: string; card_catalog_id: string } };
  assert.equal(created.resource.owner_id, ownerId);
  assert.equal(created.resource.card_catalog_id, "hdfc-infinia");

  const listResponse = await fetch(`http://127.0.0.1:${port}/resources?user_id=${ownerId}`);
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as { resources: Array<{ owner_id: string }> };
  assert.equal(list.resources.length, 1);
});

test("GET /search/network returns direct friends with requestable flag", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  server = http.createServer(createTestAppWithRepositories({ userRepository, connectionRepository, resourceRepository }));
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const currentUserId = await registerUser(userRepository, "me@example.com", "Me");
  const friendUserId = await registerUser(userRepository, "friend@example.com", "Friend");

  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const pendingRequest = await connectionService.sendRequest({ requester_id: currentUserId, addressee_id: friendUserId });
  const pending = await connectionService.accept({ connection_id: pendingRequest.id, user_id: friendUserId });
  void pending;

  const directResource = await resourceRepository.create({
    owner_id: friendUserId,
    card_catalog_id: "hdfc-infinia",
    visibility: "friends",
    request_enabled: true,
    notes: "available",
    status: "active",
  });

  const searchResponse = await fetch(`http://127.0.0.1:${port}/search/network?user_id=${currentUserId}&card_catalog_id=hdfc-infinia`);
  assert.equal(searchResponse.status, 200);
  const matches = (await searchResponse.json()) as {
    matches: Array<{ user_id: string; resource_id: string; relationship: string; requestable: boolean }>;
  };
  assert.ok(
    matches.matches.some(
      (match) =>
        match.user_id === friendUserId
        && match.resource_id === directResource.id
        && match.relationship === "direct"
        && match.requestable,
    ),
  );
});

test("POST /requests and PATCH /requests/:id support owner approval flow", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  const requestRepository = new InMemoryRequestRepository();
  server = http.createServer(createTestAppWithRepositories({
    userRepository,
    connectionRepository,
    resourceRepository,
    requestRepository,
  }));
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const requesterId = await registerUser(userRepository, "requester@example.com", "Requester");
  const ownerId = await registerUser(userRepository, "owner@example.com", "Owner");
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const connection = await connectionService.sendRequest({ requester_id: requesterId, addressee_id: ownerId });
  await connectionService.accept({ connection_id: connection.id, user_id: ownerId });

  const resourceResponse = await fetch(`http://127.0.0.1:${port}/resources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner_id: ownerId,
      card_catalog_id: "hdfc-infinia",
      visibility: "friends",
      request_enabled: true,
    }),
  });

  const resourceBody = (await resourceResponse.json()) as { resource: { id: string } };

  const requestResponse = await fetch(`http://127.0.0.1:${port}/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requester_id: requesterId,
      owner_id: ownerId,
      resource_id: resourceBody.resource.id,
      message: "Can I borrow this?",
    }),
  });

  assert.equal(requestResponse.status, 201);
  const requestBody = (await requestResponse.json()) as { request: { id: string; status: string } };

  const approveResponse = await fetch(`http://127.0.0.1:${port}/requests/${requestBody.request.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: ownerId, status: "approved" }),
  });

  assert.equal(approveResponse.status, 200);
  const approved = (await approveResponse.json()) as { request: { status: string } };
  assert.equal(approved.request.status, "approved");
});

test("approved requests gate contact handoff for both participants", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  const requestRepository = new InMemoryRequestRepository();
  server = http.createServer(createTestAppWithRepositories({
    userRepository,
    connectionRepository,
    resourceRepository,
    requestRepository,
  }));
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));

  const { port } = server.address() as AddressInfo;
  const requesterId = await registerUser(userRepository, "requester-contact@example.com", "Requester");
  const ownerId = await registerUser(userRepository, "owner-contact@example.com", "Owner");
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const connection = await connectionService.sendRequest({ requester_id: requesterId, addressee_id: ownerId });
  await connectionService.accept({ connection_id: connection.id, user_id: ownerId });
  const resource = await resourceRepository.create({
    owner_id: ownerId,
    card_catalog_id: "hdfc-infinia",
    visibility: "friends",
    request_enabled: true,
    notes: null,
  });

  const requestResponse = await fetch(`http://127.0.0.1:${port}/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requester_id: requesterId, owner_id: ownerId, resource_id: resource.id }),
  });
  const requestBody = (await requestResponse.json()) as { request: { id: string } };

  const pendingContactResponse = await fetch(`http://127.0.0.1:${port}/requests/${requestBody.request.id}/contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: requesterId }),
  });
  assert.equal(pendingContactResponse.status, 409);

  await fetch(`http://127.0.0.1:${port}/requests/${requestBody.request.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: ownerId, status: "approved" }),
  });

  const contactResponse = await fetch(`http://127.0.0.1:${port}/requests/${requestBody.request.id}/contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: requesterId }),
  });
  assert.equal(contactResponse.status, 200);
  const contactBody = (await contactResponse.json()) as { contact: { id: string; email: string } };
  assert.equal(contactBody.contact.id, ownerId);
  assert.equal(contactBody.contact.email, "owner-contact@example.com");
});

test("second-degree requests require intermediary referral approval before owner approval", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  const requestRepository = new InMemoryRequestRepository();
  const requesterId = await userRepository.upsertProfile({ id: "referral-requester", email: "referral-requester@example.com", display_name: "Requester", phone: "+919876543210", status: "active" });
  const intermediaryId = await userRepository.upsertProfile({ id: "referral-intermediary", email: "referral-intermediary@example.com", display_name: "Mutual Friend", phone: "+919876543211", status: "active" });
  const ownerId = await userRepository.upsertProfile({ id: "referral-owner", email: "referral-owner@example.com", display_name: "Owner", phone: "+919876543212", status: "active" });
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const first = await connectionService.sendRequest({ requester_id: requesterId.id, addressee_id: intermediaryId.id });
  await connectionService.accept({ connection_id: first.id, user_id: intermediaryId.id });
  const second = await connectionService.sendRequest({ requester_id: intermediaryId.id, addressee_id: ownerId.id });
  await connectionService.accept({ connection_id: second.id, user_id: ownerId.id });
  const resource = await resourceRepository.create({ owner_id: ownerId.id, card_catalog_id: "axis-atlas", visibility: "network", request_enabled: true, notes: null });
  const requestService = new RequestService({ requestRepository, userRepository, resourceRepository, connectionRepository });

  const created = await requestService.create({ requester_id: requesterId.id, owner_id: ownerId.id, resource_id: resource.id, message: "Please help" });
  assert.equal(created.request.intermediary_id, intermediaryId.id);
  assert.equal(created.request.referral_status, "pending");

  await assert.rejects(
    () => requestService.update(created.request.id, { user_id: ownerId.id, status: "approved" }),
    (error: unknown) => error instanceof Error && error.message.includes("mutual friend"),
  );

  await requestService.updateReferral(created.request.id, { user_id: intermediaryId.id, referral_status: "approved" });
  await requestService.update(created.request.id, { user_id: ownerId.id, status: "approved" });
  const contact = await requestService.revealContact(created.request.id, requesterId.id, "Hi, can we coordinate this card request?");
  assert.equal(contact.contact.phone, "+919876543212");
  assert.match(contact.contact.whatsapp_url ?? "", /wa\.me\/919876543212/);
  assert.match(contact.contact.whatsapp_url ?? "", /coordinate/);
});

test("request creation rejects non-friends and blocked connections", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  const requestRepository = new InMemoryRequestRepository();
  server = http.createServer(createTestAppWithRepositories({ userRepository, connectionRepository, resourceRepository, requestRepository }));
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));

  const { port } = server.address() as AddressInfo;
  const requesterId = await registerUser(userRepository, "requester-privacy@example.com", "Requester");
  const ownerId = await registerUser(userRepository, "owner-privacy@example.com", "Owner");
  const resource = await resourceRepository.create({
    owner_id: ownerId,
    card_catalog_id: "hdfc-infinia",
    visibility: "friends",
    request_enabled: true,
    notes: null,
  });

  const response = await fetch(`http://127.0.0.1:${port}/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requester_id: requesterId, owner_id: ownerId, resource_id: resource.id }),
  });
  assert.equal(response.status, 403);

  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const connection = await connectionService.sendRequest({ requester_id: requesterId, addressee_id: ownerId });
  await connectionService.block({ connection_id: connection.id, user_id: requesterId });

  const blockedResponse = await fetch(`http://127.0.0.1:${port}/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requester_id: requesterId, owner_id: ownerId, resource_id: resource.id }),
  });
  assert.equal(blockedResponse.status, 403);
});

test("network search hides private and blocked resources", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const resourceRepository = new InMemoryResourceRepository();
  server = http.createServer(createTestAppWithRepositories({ userRepository, connectionRepository, resourceRepository }));
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));

  const { port } = server.address() as AddressInfo;
  const currentUserId = await registerUser(userRepository, "search-me@example.com", "Me");
  const privateOwnerId = await registerUser(userRepository, "private-owner@example.com", "Private");
  const blockedOwnerId = await registerUser(userRepository, "blocked-owner@example.com", "Blocked");
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const privateConnection = await connectionService.sendRequest({ requester_id: currentUserId, addressee_id: privateOwnerId });
  await connectionService.accept({ connection_id: privateConnection.id, user_id: privateOwnerId });
  const blockedConnection = await connectionService.sendRequest({ requester_id: currentUserId, addressee_id: blockedOwnerId });
  await connectionService.block({ connection_id: blockedConnection.id, user_id: currentUserId });
  await resourceRepository.create({ owner_id: privateOwnerId, card_catalog_id: "hdfc-infinia", visibility: "private", request_enabled: true, notes: null });
  await resourceRepository.create({ owner_id: blockedOwnerId, card_catalog_id: "hdfc-infinia", visibility: "friends", request_enabled: true, notes: null });

  const response = await fetch(`http://127.0.0.1:${port}/search/network?user_id=${currentUserId}&card_catalog_id=hdfc-infinia`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { matches: Array<{ user_id: string }> };
  assert.deepEqual(body.matches, []);
});

test("resource reads and mutations require the owner or an allowed viewer", async () => {
  const userRepository = new InMemoryUserRepository();
  const resourceRepository = new InMemoryResourceRepository();
  server = http.createServer(createTestAppWithRepositories({ userRepository, resourceRepository }));
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));

  const { port } = server.address() as AddressInfo;
  const ownerId = await registerUser(userRepository, "resource-owner@example.com", "Owner");
  const strangerId = await registerUser(userRepository, "resource-stranger@example.com", "Stranger");
  const createResponse = await fetch(`http://127.0.0.1:${port}/resources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner_id: ownerId, card_catalog_id: "hdfc-infinia", visibility: "private" }),
  });
  const created = (await createResponse.json()) as { resource: { id: string } };

  const readResponse = await fetch(`http://127.0.0.1:${port}/resources/${created.resource.id}?user_id=${strangerId}`);
  assert.equal(readResponse.status, 403);
  const updateResponse = await fetch(`http://127.0.0.1:${port}/resources/${created.resource.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: strangerId, visibility: "network" }),
  });
  assert.equal(updateResponse.status, 403);
});
