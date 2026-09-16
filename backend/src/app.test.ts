import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import type { RequestHandler } from "express";

import { createApp } from "./app.js";
import { InMemoryConnectionRepository } from "./connections/connection.repository.js";
import { ConnectionService } from "./connections/connection.service.js";
import { InMemoryUserRepository } from "./users/user.repository.js";
import { UserService } from "./users/user.service.js";

let server: http.Server | undefined;

function createTestApp() {
  const userRepository = new InMemoryUserRepository();
  const userAuthMiddleware: RequestHandler = (_request, _response, next) => next();
  const optionalUserAuthMiddleware: RequestHandler = (_request, _response, next) => next();

  return createApp({
    userService: new UserService({
      userRepository,
    }),
    connectionService: new ConnectionService({
      connectionRepository: new InMemoryConnectionRepository(),
      userRepository,
    }),
    userAuthMiddleware,
    optionalUserAuthMiddleware,
  });
}

after(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test("GET /health returns ok", async () => {
  server = http.createServer(createTestApp());

  await new Promise<void>((resolve) => {
    server?.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/health`);

  assert.equal(response.status, 200);

  const body = (await response.json()) as { status?: string };
  assert.equal(body.status, "ok");
});
