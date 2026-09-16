import assert from "node:assert/strict";
import { test } from "node:test";

import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../errors/http-error.js";

import { PrismaConnectionRepository } from "./connection.repository.js";

test("PrismaConnectionRepository maps active_pair_key unique violations to a 409 HttpError", async () => {
  const repository = new PrismaConnectionRepository({
    connection: {
      create: async () => {
        throw { code: "P2002" };
      },
    },
  } as unknown as PrismaClient);

  await assert.rejects(
    repository.create({
      requester_id: "user-1",
      addressee_id: "user-2",
      status: "pending",
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.message, "An active connection already exists between these users");
      return true;
    },
  );
});
