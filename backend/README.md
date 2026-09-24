# Backend (archived — reference only)

**Not part of the deploy path.** As of issue #3, the frontend talks directly to Supabase
(PostgREST + RPC + Auth, see [`../supabase/`](../supabase)) — this Express/Prisma backend is
kept in the repo only as a reference for a possible future "more efficient" backend. Nothing
here is built, tested, or deployed by CI, and `wrangler.jsonc` no longer references it.

Minimal Node.js + Express + TypeScript scaffold for the Card Crew API.

## Stack

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL (Supabase)
- Supabase Auth

## Prerequisites

- Node.js 20+
- A Supabase project
- Supabase Postgres connection string
- Supabase URL and service role key

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project.
3. In Supabase (Project Settings → API), copy:
   - **Project URL** → `SUPABASE_URL`
   - **Secret key** (`sb_secret_...`, replaces the old "service role key") → `SUPABASE_SERVICE_ROLE_KEY`
   - **Database connection string** (Project Settings → Database → Connection string) → `DATABASE_URL`
4. Copy `.env.example` to `.env` and fill in your values.
5. Apply the committed Prisma migrations locally:

   ```bash
   npx prisma migrate dev
   ```

6. Generate the Prisma client:

   ```bash
   npx prisma generate
   ```

## Environment variables

- `DATABASE_URL`: Supabase Postgres connection string for Prisma
- `SUPABASE_URL`: Supabase project URL used by the backend to verify bearer tokens
- `SUPABASE_SERVICE_ROLE_KEY`: server-side Supabase key used only by the backend to call `auth.getUser(token)`
- `PORT`: HTTP port for the Express server (defaults to `3000`)
- `CORS_ORIGIN`: comma-separated list of allowed frontend origins (defaults to `http://localhost:5173`)

## Available scripts

- `npm run dev` — start the API in watch mode
- `npm run build` — compile TypeScript into `dist/`
- `npm start` — run the compiled server
- `npm test` — run the `/health`, user API, and connection API tests
- `npm run prisma:generate` — generate the Prisma client

## Prisma schema status

This backend now includes `User`, `Connection`, `CardCatalog`, `Resource`, and `Request` models covering
B2-B10 and exposes:

- `POST /users/sync` — authenticated profile upsert keyed by the verified Supabase user id
- `GET /users/:id` — fetch a public profile response; the profile owner can include a valid Supabase bearer token to receive email/phone too, while non-owner/invalid-token requests are limited to non-PII fields
- `POST /connections` — send a connection request with `requester_id` and `addressee_id`
- `POST /connections/:id/accept?user_id=...` — accept a pending request as the addressee
- `POST /connections/:id/block?user_id=...` — block a pending or accepted connection as either participant
- `DELETE /connections/:id?user_id=...` — soft-remove a pending or accepted connection as either participant
- `GET /connections?user_id=...&status=pending|accepted|blocked|removed` — list a user's connections by status
- `GET /catalog/cards`, `GET /catalog/cards/:id` — curated India-first catalog with issuer, network,
   card category, and UPI capability metadata. The current live seed contains 108 records across 20 issuers,
   including 28 UPI-enabled cards; startup upserts the catalog from `src/catalog/card-catalog.seed.ts`.
- `POST /resources`, `GET /resources`, `GET /resources/:id`, `PATCH /resources/:id`, `DELETE /resources/:id` — a user's added cards, with server-enforced visibility and ownership checks
- `GET /search/network` — direct-friend network search by `card_catalog_id`
- `POST /requests`, `GET /requests/incoming`, `GET /requests/outgoing`, `PATCH /requests/:id`, `POST /requests/:id/contact` — the request/approve/decline/ignore lifecycle and approval-gated contact handoff

See [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md) for the full request/response contract.

Authentication flow for B2 now uses Supabase Auth:

1. The client app signs users up or signs them in directly with the Supabase client SDK.
2. The client sends the Supabase access token in the `Authorization` header when calling `POST /users/sync`.
3. The backend verifies the token with Supabase using the server-side service role key.
4. The backend upserts the local `User` profile row using the verified Supabase user UUID as `User.id`.

Current stub-auth note: every endpoint other than `/users/sync` still uses a `user_id` query/body
parameter instead of verifying a session token, and must be protected by the same real auth model before
production use.

For deployed environments, apply migrations with `npx prisma migrate deploy`.

## Current endpoint

- `GET /health` → `{ "status": "ok" }`
