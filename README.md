# Card Crew

Card Crew is a privacy-first trusted resource network. Users add trusted friends, declare card metadata,
search their direct network or a second-degree graph, and request help without storing card numbers, CVVs,
PINs, OTPs, bank credentials, or other payment secrets.

## Current Scope

- Supabase Auth + PostgreSQL persistence through Prisma
- Curated India-first card catalog with network, variant, UPI, co-brand, and use-case metadata
- Friend invite, accept, remove, and block flows
- My Cards catalog with visual card tiles and progressive metadata review
- Direct and second-degree network graph with depth-aware search
- Direct requests and intermediary referral approval for friend-of-friend requests
- Approval-gated phone/WhatsApp contact handoff
- Mobile-first React UI with an Obsidian-inspired trust graph

Product scope and acceptance criteria live in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) and the source PRD
in [`docs/trusted_personal_resource_network_prd.md`](docs/trusted_personal_resource_network_prd.md).

## Repository Layout

```text
backend/    Express + TypeScript + Prisma API
frontend/   Vite + React + TypeScript web app
docs/       Product requirements, UI plan, API contract, release checklist
.github/    Copilot/Squad instructions and UI/UX prompt tooling
.squad/     Team coordination state and decisions
```

The CSV files under `.github/prompts/ui-ux-pro-max/data/` are intentionally versioned: they are the local
knowledge base required by the repository's UI/UX design prompt. Python caches and generated build output
are ignored.

## Prerequisites

- Node.js 20+
- A Supabase project
- Supabase Postgres connection string
- Supabase project URL
- Supabase server secret key for backend token verification
- Supabase publishable/anon key for the frontend

## Environment Setup

Backend:

```powershell
Copy-Item backend/.env.example backend/.env
# Fill DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CORS_ORIGIN.
```

Frontend:

```powershell
Copy-Item frontend/.env.example frontend/.env
# Fill VITE_API_BASE_URL, VITE_SUPABASE_URL, and VITE_SUPABASE_ANON_KEY.
```

Never commit either `.env` file. The backend service secret must never be placed in `frontend/.env`.

## Install and Run

```powershell
npm install --prefix backend
npm install --prefix frontend

npm run dev:backend
npm run dev:frontend
```

Default local URLs:

- API: http://localhost:3000
- Web app: http://localhost:5173

Apply database migrations before using a fresh database:

```powershell
npm --prefix backend run prisma:generate
npx --prefix backend prisma migrate deploy --schema backend/prisma/schema.prisma
```

## Verification

```powershell
npm test
npm run build
```

The backend tests use isolated in-memory repositories for fast API regression coverage. Production uses
Prisma-backed catalog, resource, request, and user repositories. The live UI smoke test requires valid
Supabase configuration and is documented in [`docs/MVP_RELEASE_CHECKLIST.md`](docs/MVP_RELEASE_CHECKLIST.md).

## Cloudflare Deployment

The workflow at [`.github/workflows/cloudflare-pages.yml`](.github/workflows/cloudflare-pages.yml)
deploys the Vite frontend as static assets on Cloudflare Workers whenever `main` changes. It also runs the backend tests
and builds both applications before deploying.

Create these GitHub repository settings before the first deployment:

- Secret `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Account Workers Scripts Edit permission
- Secret `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- Variable `VITE_SUPABASE_URL`: Supabase project URL
- Variable `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon key

### Cloudflare Container API

The same Cloudflare Worker also proxies API routes to the Express/Prisma backend in a Cloudflare Container.
Cloudflare Containers require the Workers Paid plan. Before deploying the container, create these additional
GitHub Actions secrets:

- `DATABASE_URL`: Supabase PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase server secret key

The frontend requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions variables.
They are public browser configuration, not server secrets. It calls the API at the same Cloudflare Worker
origin, so no `VITE_API_BASE_URL` is needed. The workflow copies backend secrets into Cloudflare Worker
secrets, and the proxy passes them only to the API container at startup.

## Contributing

1. Read the PRD and relevant plan before changing behavior.
2. Start work from the `dev` branch when the repository has a remote integration workflow.
3. Keep changes focused and use conventional commit messages such as `feat:`, `fix:`, `test:`, `docs:`,
   and `chore:`.
4. Update tests whenever an API or public behavior changes.
5. Keep privacy rules server-side and never add credential fields.
6. Run `npm test` and `npm run build` before opening a pull request.
7. Record cross-cutting decisions in `.squad/decisions/inbox/`.

## Security Boundary

Card Crew stores metadata and permissions only. Do not add fields or logs for full card numbers, CVs, PINs,
OTPs, UPI PINs, internet-banking passwords, or other bank credentials. Contact details are revealed only
after the applicable direct-owner or intermediary approval path succeeds.

## Key Documents

- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
- [`docs/design.md`](docs/design.md)
- [`docs/UI_PLAN.md`](docs/UI_PLAN.md)
- [`docs/USER_STORY_CARD_DETAILS.md`](docs/USER_STORY_CARD_DETAILS.md)
- [`docs/MVP_SIGNOFF.md`](docs/MVP_SIGNOFF.md)
- [`docs/MVP_RELEASE_CHECKLIST.md`](docs/MVP_RELEASE_CHECKLIST.md)