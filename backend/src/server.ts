import "dotenv/config";

import { PrismaCardCatalogRepository } from "./catalog/card-catalog.repository.js";
import { PrismaConnectionRepository } from "./connections/connection.repository.js";
import { ConnectionService } from "./connections/connection.service.js";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import {
  createOptionalSupabaseAuthMiddleware,
  createSupabaseAuthMiddleware,
  createSupabaseAuthVerifier,
} from "./middleware/supabase-auth.js";
import { PrismaUserRepository } from "./users/user.repository.js";
import { UserService } from "./users/user.service.js";
import { PrismaResourceRepository } from "./resources/resource.repository.js";
import { ResourceService } from "./resources/resource.service.js";
import { PrismaRequestRepository } from "./requests/request.repository.js";
import { RequestService } from "./requests/request.service.js";
import { NetworkService } from "./network/network.service.js";

const DEFAULT_PORT = 3000;
const port = parsePort(process.env.PORT);
const userRepository = new PrismaUserRepository(prisma);
const catalogRepository = new PrismaCardCatalogRepository(prisma);
const resourceRepository = new PrismaResourceRepository(prisma);
const requestRepository = new PrismaRequestRepository(prisma);
const userService = new UserService({
  userRepository,
});
const connectionService = new ConnectionService({
  connectionRepository: new PrismaConnectionRepository(prisma),
  userRepository,
});
const resourceService = new ResourceService({
  resourceRepository,
  userRepository,
  cardCatalogRepository: catalogRepository,
  connectionRepository: new PrismaConnectionRepository(prisma),
});
const requestService = new RequestService({
  requestRepository,
  userRepository,
  resourceRepository,
  connectionRepository: new PrismaConnectionRepository(prisma),
});
const networkService = new NetworkService({
  connectionRepository: new PrismaConnectionRepository(prisma),
  userRepository,
  resourceRepository,
});
const supabaseAuthVerifier = createSupabaseAuthVerifier({
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
const userAuthMiddleware = createSupabaseAuthMiddleware({
  verifier: supabaseAuthVerifier,
});
const optionalUserAuthMiddleware = createOptionalSupabaseAuthMiddleware({
  verifier: supabaseAuthVerifier,
});
const app = createApp({
  userService,
  connectionService,
  catalogRepository,
  resourceService,
  requestService,
  networkService,
  userAuthMiddleware,
  optionalUserAuthMiddleware,
});

catalogRepository.ensureSeeded().then(() => {
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}).catch((error: unknown) => {
  console.error("Failed to seed card catalog", error);
  process.exitCode = 1;
});

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return parsed;
}
