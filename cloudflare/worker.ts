import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

type Environment = {
  API_CONTAINER: DurableObjectNamespace<CardCrewApiContainer>;
  ASSETS: Fetcher;
};

class CardCrewApiContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
  envVars = {
    CORS_ORIGIN: env.CORS_ORIGIN,
    DATABASE_URL: env.DATABASE_URL,
    NODE_ENV: "production",
    PORT: "3000",
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: env.SUPABASE_URL,
  };
}

const API_PATHS = ["/health", "/catalog", "/connections", "/network", "/requests", "/resources", "/search", "/users"];

export { CardCrewApiContainer };

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return environment.API_CONTAINER.getByName("production").fetch(request);
    }

    return environment.ASSETS.fetch(request);
  },
};