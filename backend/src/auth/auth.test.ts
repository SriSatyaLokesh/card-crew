import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";

import { createApp } from "../app.js";
import { AuthService } from "./auth.service.js";
import { InMemoryUserRepository } from "../users/user.repository.js";
import { InMemoryConnectionRepository } from "../connections/connection.repository.js";
import { ConnectionService } from "../connections/connection.service.js";
import { UserService } from "../users/user.service.js";
import {
  createSupabaseAuthMiddleware,
  createOptionalSupabaseAuthMiddleware,
  createSupabaseAuthVerifier,
} from "../middleware/supabase-auth.js";
import { hashPassword, verifyPassword } from "./password.util.js";
import { generateToken, verifyToken } from "./token.util.js";

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

test("password utility hashes and verifies passwords correctly", () => {
  const password = "mySecurePassword123!";
  const hash = hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("wrongPassword", hash), false);
});

test("token utility generates and verifies tokens with expiration", () => {
  const token = generateToken({
    sub: "user-123",
    email: "test@example.com",
    display_name: "Test User",
  });

  assert.ok(token);
  const payload = verifyToken(token);
  assert.ok(payload);
  assert.equal(payload.sub, "user-123");
  assert.equal(payload.email, "test@example.com");
  assert.equal(payload.display_name, "Test User");

  const invalid = verifyToken("invalid.token.here");
  assert.equal(invalid, null);
});

test("Auth flow: signup duplicate error, login not-found error, and successful login", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const userService = new UserService({ userRepository, connectionRepository });
  const connectionService = new ConnectionService({ connectionRepository, userRepository });

  const mockUsers: any[] = [];
  const mockPrisma: any = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.email) return mockUsers.find((u) => u.email === where.email) || null;
        if (where.id) return mockUsers.find((u) => u.id === where.id) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const user = { ...data, created_at: new Date(), updated_at: new Date() };
        mockUsers.push(user);
        await userRepository.upsertProfile({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          phone: null,
          status: "active",
        });
        return user;
      },
      update: async ({ where, data }: any) => {
        const user = mockUsers.find((u) => u.id === where.id);
        if (user) {
          Object.assign(user, data, { updated_at: new Date() });
          return user;
        }
        return null;
      },
    },
  };

  const authService = new AuthService(mockPrisma);
  const verifier = createSupabaseAuthVerifier({});
  const userAuthMiddleware = createSupabaseAuthMiddleware({ verifier });
  const optionalUserAuthMiddleware = createOptionalSupabaseAuthMiddleware({ verifier });

  const app = createApp({
    userService,
    connectionService,
    authService,
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. Login with non-existent user -> 404 "User does not exist. Please sign up first."
  const loginNotFoundRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@example.com", password: "password123" }),
  });
  const notFoundBody = await loginNotFoundRes.json();
  assert.equal(loginNotFoundRes.status, 404);
  assert.equal(notFoundBody.error, "User does not exist. Please sign up first.");

  // 2. Signup a new user
  const signupRes = await fetch(`${baseUrl}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alice@example.com",
      password: "password123",
      displayName: "Alice Wonderland",
    }),
  });
  const signupBody = await signupRes.json();
  assert.equal(signupRes.status, 201);
  assert.ok(signupBody.token);
  assert.equal(signupBody.user.email, "alice@example.com");
  assert.equal(signupBody.user.display_name, "Alice Wonderland");

  // 3. Signup duplicate email -> 409 "An account with this email already exists."
  const signupDupRes = await fetch(`${baseUrl}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alice@example.com",
      password: "password456",
      displayName: "Alice Clone",
    }),
  });
  const dupBody = await signupDupRes.json();
  assert.equal(signupDupRes.status, 409);
  assert.equal(dupBody.error, "An account with this email already exists.");

  // 4. Login with wrong password -> 401 "Invalid email or password."
  const loginWrongPwRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "wrongPassword" }),
  });
  const wrongPwBody = await loginWrongPwRes.json();
  assert.equal(loginWrongPwRes.status, 401);
  assert.equal(wrongPwBody.error, "Invalid email or password.");

  // 5. Login with correct password -> 200 with token and user
  const loginSuccessRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "password123" }),
  });
  const loginSuccessBody = await loginSuccessRes.json();
  assert.equal(loginSuccessRes.status, 200);
  assert.ok(loginSuccessBody.token);
  assert.equal(loginSuccessBody.user.email, "alice@example.com");

  // 6. Access /auth/me with bearer token -> verify has_password is true
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${loginSuccessBody.token}` },
  });
  const meBody = await meRes.json();
  assert.equal(meRes.status, 200);
  assert.equal(meBody.user.email, "alice@example.com");
  assert.equal(meBody.user.has_password, true);

  // 7. Change password: wrong current password -> 400
  const changeWrongPwRes = await fetch(`${baseUrl}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginSuccessBody.token}`,
    },
    body: JSON.stringify({
      currentPassword: "wrongCurrentPassword",
      newPassword: "brandNewPassword123!",
      confirmPassword: "brandNewPassword123!",
    }),
  });
  const changeWrongPwBody = await changeWrongPwRes.json();
  assert.equal(changeWrongPwRes.status, 400);
  assert.equal(changeWrongPwBody.error, "Current password is incorrect");

  // 8. Change password: short password (< 8 chars) -> 400
  const changeShortPwRes = await fetch(`${baseUrl}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginSuccessBody.token}`,
    },
    body: JSON.stringify({
      currentPassword: "password123",
      newPassword: "short",
      confirmPassword: "short",
    }),
  });
  assert.equal(changeShortPwRes.status, 400);

  // 9. Change password: mismatched confirmation -> 400
  const changeMismatchRes = await fetch(`${baseUrl}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginSuccessBody.token}`,
    },
    body: JSON.stringify({
      currentPassword: "password123",
      newPassword: "brandNewPassword123!",
      confirmPassword: "differentPassword123!",
    }),
  });
  const changeMismatchBody = await changeMismatchRes.json();
  assert.equal(changeMismatchRes.status, 400);
  assert.equal(changeMismatchBody.error, "New passwords do not match");

  // 10. Change password successfully -> 200
  const changeSuccessRes = await fetch(`${baseUrl}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginSuccessBody.token}`,
    },
    body: JSON.stringify({
      currentPassword: "password123",
      newPassword: "brandNewPassword123!",
      confirmPassword: "brandNewPassword123!",
    }),
  });
  const changeSuccessBody = await changeSuccessRes.json();
  assert.equal(changeSuccessRes.status, 200);
  assert.equal(changeSuccessBody.message, "Password updated successfully");

  // 11. Old password can no longer log in -> 401
  const loginOldPwRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "password123" }),
  });
  assert.equal(loginOldPwRes.status, 401);

  // 12. New password logs in successfully -> 200
  const loginNewPwRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "brandNewPassword123!" }),
  });
  const loginNewPwBody = await loginNewPwRes.json();
  assert.equal(loginNewPwRes.status, 200);
  assert.ok(loginNewPwBody.token);

  // 13. User without existing password (password_hash: null) can set initial password without currentPassword
  const oauthUser = {
    id: "usr-oauth-bob",
    email: "bob@oauth.local",
    display_name: "Bob OAuth",
    password_hash: null,
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  };
  mockUsers.push(oauthUser);
  const bobToken = generateToken({ sub: oauthUser.id, email: oauthUser.email, display_name: oauthUser.display_name });

  const bobMeRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${bobToken}` },
  });
  const bobMeBody = await bobMeRes.json();
  assert.equal(bobMeRes.status, 200);
  assert.equal(bobMeBody.user.has_password, false);

  const bobSetPwRes = await fetch(`${baseUrl}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bobToken}`,
    },
    body: JSON.stringify({
      newPassword: "bobSecurePassword123!",
      confirmPassword: "bobSecurePassword123!",
    }),
  });
  const bobSetPwBody = await bobSetPwRes.json();
  assert.equal(bobSetPwRes.status, 200);
  assert.equal(bobSetPwBody.message, "Password updated successfully");

  // Bob can now log in with the newly set password
  const bobLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bob@oauth.local", password: "bobSecurePassword123!" }),
  });
  assert.equal(bobLoginRes.status, 200);
});

test("Blocking & unblocking lifecycle: removes friendship, unblock does not restore friendship, allows fresh request", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const userService = new UserService({ userRepository, connectionRepository });
  const connectionService = new ConnectionService({ connectionRepository, userRepository });

  const verifier = createSupabaseAuthVerifier({});
  const userAuthMiddleware = createSupabaseAuthMiddleware({ verifier });
  const optionalUserAuthMiddleware = createOptionalSupabaseAuthMiddleware({ verifier });

  const app = createApp({
    userService,
    connectionService,
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userA = await userRepository.upsertProfile({
    id: "usr-a",
    email: "a@example.com",
    display_name: "User A",
    phone: null,
    status: "active",
  });

  const userB = await userRepository.upsertProfile({
    id: "usr-b",
    email: "b@example.com",
    display_name: "User B",
    phone: null,
    status: "active",
  });

  const tokenA = generateToken({ sub: userA.id, email: userA.email, display_name: userA.display_name });

  // 1. A sends friend request to B
  const reqRes = await fetch(`${baseUrl}/connections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ addressee_id: userB.id }),
  });
  const reqBody = await reqRes.json();
  assert.equal(reqRes.status, 201);
  const connId = reqBody.connection.id;

  // 2. B accepts request
  const acceptRes = await fetch(`${baseUrl}/connections/${connId}/accept?user_id=${userB.id}`, {
    method: "POST",
  });
  const acceptBody = await acceptRes.json();
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptBody.connection.status, "accepted");

  // Verify they are direct friends
  const friendsRes = await fetch(`${baseUrl}/connections?user_id=${userA.id}&status=accepted`);
  const friendsBody = await friendsRes.json();
  assert.equal(friendsBody.connections.length, 1);

  // 3. A blocks B
  const blockRes = await fetch(`${baseUrl}/connections/${userB.id}/block`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(blockRes.status, 200);

  // B is removed from A's direct friends
  const friendsAfterBlock = await fetch(`${baseUrl}/connections?user_id=${userA.id}&status=accepted`);
  const friendsAfterBlockBody = await friendsAfterBlock.json();
  assert.equal(friendsAfterBlockBody.connections.length, 0);

  // B appears in blocked list
  const blockedListRes = await fetch(`${baseUrl}/connections/blocked`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const blockedListBody = await blockedListRes.json();
  assert.equal(blockedListRes.status, 200);
  assert.equal(blockedListBody.blocks.length, 1);
  assert.equal(blockedListBody.blocks[0].blocked_id, userB.id);

  // 4. A unblocks B
  const unblockRes = await fetch(`${baseUrl}/connections/${userB.id}/unblock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(unblockRes.status, 200);

  // Friendship is NOT automatically restored
  const friendsAfterUnblock = await fetch(`${baseUrl}/connections?user_id=${userA.id}&status=accepted`);
  const friendsAfterUnblockBody = await friendsAfterUnblock.json();
  assert.equal(friendsAfterUnblockBody.connections.length, 0);

  // Block is gone from blocked list
  const blockedListAfterUnblock = await fetch(`${baseUrl}/connections/blocked`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const blockedListAfterUnblockBody = await blockedListAfterUnblock.json();
  assert.equal(blockedListAfterUnblockBody.blocks.length, 0);

  // 5. A can send a fresh new friend request to B
  const newReqRes = await fetch(`${baseUrl}/connections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ addressee_id: userB.id }),
  });
  const newReqBody = await newReqRes.json();
  assert.equal(newReqRes.status, 201);
  assert.equal(newReqBody.connection.status, "pending");
});

test("Network Search: calculates friends-of-friends and mutual friend name from database", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const userService = new UserService({ userRepository, connectionRepository });
  const connectionService = new ConnectionService({ connectionRepository, userRepository });

  const verifier = createSupabaseAuthVerifier({});
  const userAuthMiddleware = createSupabaseAuthMiddleware({ verifier });
  const optionalUserAuthMiddleware = createOptionalSupabaseAuthMiddleware({ verifier });

  const app = createApp({
    userService,
    connectionService,
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  // User A, User B, User C
  // A is friend with B. B is friend with C.
  const userA = await userRepository.upsertProfile({
    id: "usr-alice",
    email: "alice@test.com",
    display_name: "Alice",
    phone: null,
    status: "active",
  });
  const userB = await userRepository.upsertProfile({
    id: "usr-bob",
    email: "bob@test.com",
    display_name: "Bob",
    phone: null,
    status: "active",
  });
  const userC = await userRepository.upsertProfile({
    id: "usr-charlie",
    email: "charlie@test.com",
    display_name: "Charlie",
    phone: null,
    status: "active",
  });

  // A connects with B (accepted)
  await connectionRepository.create({ requester_id: userA.id, addressee_id: userB.id, status: "accepted" });
  // B connects with C (accepted)
  await connectionRepository.create({ requester_id: userB.id, addressee_id: userC.id, status: "accepted" });

  // Override findMutualFriendNames for InMemoryConnectionRepository in this test
  connectionRepository.findMutualFriendNames = async (u1: string, u2: string) => {
    const c1 = await connectionRepository.listByUser(u1, "accepted");
    const c2 = await connectionRepository.listByUser(u2, "accepted");
    const f1 = new Set(c1.map((c) => (c.requester_id === u1 ? c.addressee_id : c.requester_id)));
    const f2 = new Set(c2.map((c) => (c.requester_id === u2 ? c.addressee_id : c.requester_id)));
    const mutuals = [...f1].filter((id) => f2.has(id));
    const names = [];
    for (const m of mutuals) {
      const u = await userRepository.findById(m);
      if (u) names.push(u.display_name);
    }
    return names;
  };

  const tokenA = generateToken({ sub: userA.id, email: userA.email, display_name: userA.display_name });

  // A searches for Charlie
  const searchRes = await fetch(`${baseUrl}/users/search?q=Charlie`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const searchBody = await searchRes.json();

  assert.equal(searchRes.status, 200);
  assert.equal(searchBody.users.length, 1);
  const charlieResult = searchBody.users[0];
  assert.equal(charlieResult.display_name, "Charlie");
  assert.equal(charlieResult.relationship, "friend_of_friend");
  assert.equal(charlieResult.mutual_friend_name, "Bob");
});

test("GET /network/stats returns accurate network statistics and /network/friends-of-friends returns FoF list", async () => {
  const userRepository = new InMemoryUserRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const userService = new UserService({ userRepository, connectionRepository });
  const connectionService = new ConnectionService({ connectionRepository, userRepository });
  const networkService = new (await import("../network/network.service.js")).NetworkService({
    connectionRepository,
    userRepository,
    resourceRepository: new (await import("../resources/resource.repository.js")).InMemoryResourceRepository(),
  });

  const verifier = createSupabaseAuthVerifier({});
  const userAuthMiddleware = createSupabaseAuthMiddleware({ verifier });
  const optionalUserAuthMiddleware = createOptionalSupabaseAuthMiddleware({ verifier });

  const app = createApp({
    userService,
    connectionService,
    networkService,
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userA = await userRepository.upsertProfile({
    id: "usr-me",
    email: "me@test.com",
    display_name: "Me",
    phone: null,
    status: "active",
  });
  const userB = await userRepository.upsertProfile({
    id: "usr-friend",
    email: "friend@test.com",
    display_name: "Friend",
    phone: null,
    status: "active",
  });
  const userC = await userRepository.upsertProfile({
    id: "usr-fof",
    email: "fof@test.com",
    display_name: "Friend of Friend",
    phone: null,
    status: "active",
  });
  const userD = await userRepository.upsertProfile({
    id: "usr-requester",
    email: "req@test.com",
    display_name: "Requester",
    phone: null,
    status: "active",
  });
  const userE = await userRepository.upsertProfile({
    id: "usr-addressee",
    email: "add@test.com",
    display_name: "Addressee",
    phone: null,
    status: "active",
  });
  const userF = await userRepository.upsertProfile({
    id: "usr-blocker",
    email: "blocker@test.com",
    display_name: "Blocker",
    phone: null,
    status: "active",
  });

  // Direct friend: Me <-> B (accepted)
  await connectionRepository.create({ requester_id: userA.id, addressee_id: userB.id, status: "accepted" });
  // B <-> C (accepted) -> C is Friend of Friend to Me
  await connectionRepository.create({ requester_id: userB.id, addressee_id: userC.id, status: "accepted" });
  // Incoming request: D -> Me (pending)
  await connectionRepository.create({ requester_id: userD.id, addressee_id: userA.id, status: "pending" });
  // Pending request: Me -> E (pending)
  await connectionRepository.create({ requester_id: userA.id, addressee_id: userE.id, status: "pending" });
  // Blocked me: F blocks Me
  await connectionRepository.blockUser(userF.id, userA.id);

  const tokenA = generateToken({ sub: userA.id, email: userA.email, display_name: userA.display_name });

  // 1. Check stats
  const statsRes = await fetch(`${baseUrl}/network/stats`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const stats = await statsRes.json();
  assert.equal(statsRes.status, 200);
  assert.equal(stats.directFriends, 1);
  assert.equal(stats.friendsOfFriends, 1);
  assert.equal(stats.incomingRequests, 1);
  assert.equal(stats.pendingRequests, 1);
  assert.equal(stats.totalRequests, 2);
  assert.equal(stats.blockedMe, 1);

  // 2. Check friends of friends list
  const fofRes = await fetch(`${baseUrl}/network/friends-of-friends`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const fofData = await fofRes.json();
  assert.equal(fofRes.status, 200);
  assert.equal(fofData.friendsOfFriends.length, 1);
  assert.equal(fofData.friendsOfFriends[0].display_name, "Friend of Friend");
  assert.equal(fofData.friendsOfFriends[0].mutual_friend_name, "Friend");
  assert.equal(fofData.friendsOfFriends[0].mutual_friends_count, 1);
});
