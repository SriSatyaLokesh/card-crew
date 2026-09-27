# Card Crew

**Find what you need through people you trust.**

Card Crew is a privacy-first, trusted-network app for discovering a
specific credit/debit card — and eventually other shareable resources like
coupons, vouchers, and lounge access — through people you actually know.
Users declare card *metadata*, search their direct or second-degree
network, and request help from the owner, who stays in control of how (or
whether) they help. Card Crew never asks for or stores card numbers, CVVs,
PINs, OTPs, bank credentials, or any other payment secret.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Cloudflare Pages](https://github.com/SriSatyaLokesh/card-crew/actions/workflows/cloudflare-pages.yml/badge.svg)](https://github.com/SriSatyaLokesh/card-crew/actions/workflows/cloudflare-pages.yml)

## Table of Contents

- [The idea](#the-idea)
- [Current scope](#current-scope)
- [Architecture — mid-migration](#architecture--mid-migration)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Environment setup](#environment-setup)
- [Install and run](#install-and-run)
- [Verification](#verification)
- [Cloudflare deployment](#cloudflare-deployment)
- [Security boundary](#security-boundary)
- [Contributing](#contributing)
- [Community](#community)
- [Key documents](#key-documents)
- [License](#license)

## The idea

People regularly need something someone they know already has: a card
that qualifies for an offer, an unused discount voucher, a legitimately
shareable subscription slot, airport lounge access. Today that discovery
happens over WhatsApp groups, phone calls, and memory. Card Crew turns it
into a structured, permissioned lookup:

> People declare what they have → the network indexes it → people search
> for what they need → the app finds trusted matches → the owner decides
> how to help.

Cards are the first resource category, not the product definition — the
data model is deliberately generic so the same trust graph can extend to
other resources later. The full product thesis, target users, and
phased roadmap (MVP → V1 → V2) live in the
[PRD](docs/trusted_personal_resource_network_prd.md); the system-level view
of how that's built is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Current Scope

- Supabase Auth + PostgreSQL persistence
- Curated India-first card catalog with network, variant, UPI, co-brand, and use-case metadata
- Friend invite, accept, remove, and block flows
- My Cards catalog with visual card tiles and progressive metadata review
- Direct and second-degree network graph with depth-aware search
- Direct requests and intermediary referral approval for friend-of-friend requests
- Approval-gated phone/WhatsApp contact handoff
- Mobile-first React UI with an Obsidian-inspired trust graph

Product scope and acceptance criteria live in the source PRD,
[`docs/trusted_personal_resource_network_prd.md`](docs/trusted_personal_resource_network_prd.md).

## Architecture — mid-migration

Card Crew is moving off a custom Express/Prisma API onto a Supabase-native
backend (PostgREST + `SECURITY DEFINER` RPC functions + Row Level Security
— no application server), so the frontend can deploy as a static site with
nothing else to run. Full design and rationale: [issue #3][issue-3]. A
system diagram, component breakdown, and the full request/approval data
flow live in [`ARCHITECTURE.md`](ARCHITECTURE.md) — the table below is
just the migration status at a glance.

| | Status |
|---|---|
| **Schema, RLS policies, RPC catalog** (`supabase/`) | Built and tested against a real local Supabase instance — [`supabase/README.md`](supabase/README.md) |
| **Frontend calling Supabase directly** | Not started. `frontend/` still calls the Express API below. |
| **Deploy simplification** (drop the Cloudflare Container) | Not started. |

Until the frontend cutover lands, **the section below is what's actually
deployed and what `npm run dev:backend` starts** — a conventional Express +
Prisma API, talking to the same Supabase Postgres instance directly (not
through PostgREST), running as a Cloudflare Container behind the Worker
that also serves the frontend.

[issue-3]: https://github.com/SriSatyaLokesh/card-crew/issues/3

## Repository Layout

```text
backend/            Express + TypeScript + Prisma API (today's live backend)
frontend/           Vite + React + TypeScript web app
supabase/           Postgres schema, RLS policies, and RPC catalog for the Supabase-native backend
tests/integration/  Vitest suite exercising supabase/ against a real local Supabase instance
docs/               PRD, database design/migration plan, API contract, UI design system
.github/            CI workflows, issue/PR templates, Copilot/Squad instructions, UI/UX prompt tooling
.squad/             Team coordination state and decisions for the maintainers' AI-agent workflow
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

Working on `supabase/` or `tests/integration/` also needs the [Supabase CLI](https://supabase.com/docs/guides/cli)
and Docker (for `supabase start`'s local Postgres/PostgREST/GoTrue stack) — not required for the
Express/Prisma path above.

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

### Running the Supabase-native layer locally

Separate from the steps above — this is the in-progress replacement backend (`supabase/`), not yet wired
to `frontend/`. Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```powershell
supabase start   # local Postgres + PostgREST + GoTrue; applies supabase/migrations and supabase/seed.sql
```

## Verification

```powershell
npm test
npm run build
```

The backend tests use isolated in-memory repositories for fast API regression coverage; `npm test` at the
repo root only runs these. The Supabase-native layer has its own suite in `tests/integration/`, run
separately against a real local Supabase instance:

```powershell
supabase start
cd tests/integration
npm install
npm test
```

See [`supabase/README.md`](supabase/README.md) for the schema/RLS/RPC layout and the CI guardrails that
run alongside it.

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

## Security Boundary

Card Crew stores metadata and permissions only. Do not add fields or logs for full card numbers, CVs, PINs,
OTPs, UPI PINs, internet-banking passwords, or other bank credentials. Contact details are revealed only
after the applicable direct-owner or intermediary approval path succeeds. Found an actual vulnerability?
Report it privately — see [`SECURITY.md`](SECURITY.md).

## Contributing

Contributions are welcome — code, docs, design, and issue triage all count.
Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guide
(setup, branching, commit conventions, testing, PR process, and how issue
labels/types work), and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for how
we expect people to treat each other here. The short version:

1. Read the PRD and relevant plan before changing behavior.
2. Keep changes focused and use conventional commit messages such as `feat:`, `fix:`, `test:`, `docs:`,
   and `chore:`.
3. Update tests whenever an API or public behavior changes.
4. Keep privacy rules server-side and never add credential fields.
5. Run `npm test` and `npm run build` before opening a pull request. Changes under `supabase/` also need
   `supabase db reset` plus the guardrails and `tests/integration/` suite passing locally — see
   [`supabase/README.md`](supabase/README.md).

Good first issues are labeled [`good first issue`](https://github.com/SriSatyaLokesh/card-crew/labels/good%20first%20issue).

## Community

- **Bugs / features / docs / questions:** [open an issue](https://github.com/SriSatyaLokesh/card-crew/issues/new/choose) — pick the template that fits.
- **Security vulnerability:** do **not** open a public issue — see [`SECURITY.md`](SECURITY.md).
- **General discussion:** [GitHub Discussions](https://github.com/SriSatyaLokesh/card-crew/discussions), if enabled on this repository.

## Key Documents

- [`docs/trusted_personal_resource_network_prd.md`](docs/trusted_personal_resource_network_prd.md) — PRD / the idea
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system design, data flow, migration status
- [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) — Postgres/Supabase schema, RLS and privacy model
- [`docs/DATABASE_MIGRATION_PLAN.md`](docs/DATABASE_MIGRATION_PLAN.md) — findings and phased migration plan
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — request/response contract
- [`docs/design.md`](docs/design.md) — UI design system
- [`supabase/README.md`](supabase/README.md) — Supabase-native layer: layout, privilege model, CI guardrails
- [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) · [`SECURITY.md`](SECURITY.md)

## License

Card Crew is licensed under the [Apache License, Version 2.0](LICENSE).
Apache 2.0 includes an explicit patent grant and patent-litigation
termination clause (see [`NOTICE`](NOTICE)), which matters here: parts of
Card Crew's approach are intended to be patentable, and this license lets
the community freely use, modify, and build on the code while that patent
grant structure stays intact — it protects contributors and users alike,
rather than leaving patent rights ambiguous the way a bare MIT/no-license
repo would.

Copyright © 2026 SriSatyaLokesh.
