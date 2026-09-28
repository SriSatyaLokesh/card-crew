import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";

import { createCatalogRouter } from "./catalog/card-catalog.routes.js";
import { createConnectionRouter } from "./connections/connection.routes.js";
import { HttpError } from "./errors/http-error.js";
import { createRequestRouter } from "./requests/request.routes.js";
import { createResourceRouter } from "./resources/resource.routes.js";
import { createUserRouter } from "./users/user.routes.js";
import { createAuthRouter } from "./auth/auth.routes.js";
import type { AuthService } from "./auth/auth.service.js";
import type { ConnectionService } from "./connections/connection.service.js";
import type { CardCatalogRepository } from "./catalog/card-catalog.repository.js";
import type { ResourceService } from "./resources/resource.service.js";
import type { RequestService } from "./requests/request.service.js";
import type { NetworkService } from "./network/network.service.js";
import type { UserService } from "./users/user.service.js";
import { createCardRouter } from "./cards/card.routes.js";
import type { CardService } from "./cards/card.service.js";

type AppDependencies = {
  userService: UserService;
  connectionService: ConnectionService;
  authService?: AuthService;
  catalogRepository?: CardCatalogRepository;
  cardService?: CardService;
  resourceService?: ResourceService;
  requestService?: RequestService;
  networkService?: NetworkService;
  userAuthMiddleware: RequestHandler;
  optionalUserAuthMiddleware: RequestHandler;
};

function createApp({
  userService,
  connectionService,
  authService,
  catalogRepository,
  cardService,
  resourceService,
  requestService,
  networkService,
  userAuthMiddleware,
  optionalUserAuthMiddleware,
}: AppDependencies) {
  const app = express();

  app.use(cors({ origin: parseCorsOrigins(process.env.CORS_ORIGIN) }));
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  if (authService) {
    app.use("/auth", createAuthRouter({ authService, userAuthMiddleware }));
  }
  if (catalogRepository) {
    app.use("/catalog", createCatalogRouter({ catalogRepository }));
  }
  if (cardService) {
    app.use("/cards", createCardRouter({ cardService, optionalUserAuthMiddleware }));
  }
  app.use("/users", createUserRouter({ userService, userAuthMiddleware, optionalUserAuthMiddleware }));
  app.use(
    "/connections",
    createConnectionRouter({ connectionService, optionalUserAuthMiddleware }),
  );
  if (resourceService) {
    app.use("/resources", createResourceRouter({ resourceService }));
  }
  if (requestService) {
    app.use("/requests", createRequestRouter({ requestService }));
  }

  app.get("/search/network", async (request, response) => {
    if (!resourceService) {
      response.status(501).json({ error: "Network search is not configured" });
      return;
    }

    const userId = String(request.query.user_id ?? "");
    const cardCatalogId = String(request.query.card_catalog_id ?? "");
    const depth = Number(request.query.depth ?? 1);

    if (!userId || !cardCatalogId) {
      response.status(400).json({ error: "Both user_id and card_catalog_id are required" });
      return;
    }

    const result = await resourceService.findNetworkMatchesForCard(userId, cardCatalogId, depth);
    response.status(200).json({ matches: result.matches });
  });

  app.get("/network/graph", optionalUserAuthMiddleware, async (request, response) => {
    if (!networkService) {
      response.status(501).json({ error: "Network graph is not configured" });
      return;
    }

    const userId = String(request.query.user_id || request.authUserId || "");
    const depth = Number(request.query.depth ?? 2);
    if (!userId) {
      response.status(400).json({ error: "user_id query parameter is required" });
      return;
    }

    const graph = await networkService.graph(userId, depth);
    response.status(200).json(graph);
  });

  app.get("/network/stats", optionalUserAuthMiddleware, async (request, response) => {
    if (!networkService) {
      response.status(501).json({ error: "Network stats is not configured" });
      return;
    }

    const userId = String(request.query.user_id || request.authUserId || "");
    if (!userId) {
      response.status(401).json({ error: "Authenticated user ID is required" });
      return;
    }

    try {
      const stats = await networkService.getStats(userId);
      response.status(200).json(stats);
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.statusCode).json({ error: error.message });
      } else {
        response.status(500).json({ error: "Failed to load network stats" });
      }
    }
  });

  app.get("/network/friends-of-friends", optionalUserAuthMiddleware, async (request, response) => {
    if (!networkService) {
      response.status(501).json({ error: "Network service is not configured" });
      return;
    }

    const userId = String(request.query.user_id || request.authUserId || "");
    if (!userId) {
      response.status(401).json({ error: "Authenticated user ID is required" });
      return;
    }

    try {
      const friendsOfFriends = await networkService.getFriendsOfFriends(userId);
      response.status(200).json({ friendsOfFriends });
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.statusCode).json({ error: error.message });
      } else {
        response.status(500).json({ error: "Failed to load friends of friends" });
      }
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Malformed JSON request body" });
      return;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      (("type" in error && error.type === "entity.too.large") ||
        ("status" in error && (error as { status: number }).status === 413))
    ) {
      response.status(413).json({ error: "Image or payload is too large. Please select an image under 10MB." });
      return;
    }

    if (error instanceof HttpError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return ["http://localhost:5173"];
  }

  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export { createApp };
