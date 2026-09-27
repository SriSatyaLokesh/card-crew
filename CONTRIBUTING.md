# Contributing to Card Crew

Thanks for considering a contribution to Card Crew — a privacy-first,
trusted-network app for finding a card, offer, or benefit through people you
actually know. This document is the practical guide: how to set up the
project, how work is organized, and what we expect in a pull request.

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md) — participation
in this project means agreeing to it.

If you're looking for the product vision rather than the mechanics of
contributing, start with the
[PRD](docs/trusted_personal_resource_network_prd.md) and
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Table of Contents

- [Ways to contribute](#ways-to-contribute)
- [Before you start](#before-you-start)
- [Development setup](#development-setup)
- [Repository layout](#repository-layout)
- [Branching and commits](#branching-and-commits)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Opening a pull request](#opening-a-pull-request)
- [Issue types and labels](#issue-types-and-labels)
- [The Squad AI agents](#the-squad-ai-agents)
- [Security and privacy contributions](#security-and-privacy-contributions)
- [Getting help](#getting-help)

## Ways to contribute

You don't have to write TypeScript to help:

- **Report bugs** — see [Issue types and labels](#issue-types-and-labels).
- **Improve docs** — the README, this file, `ARCHITECTURE.md`, and the
  files under `docs/` are all fair game. Docs-only PRs are welcome and
  usually quick to review.
- **Triage issues** — confirming a repro, narrowing down a cause, or
  linking a duplicate is genuinely useful even without a code change.
- **Design/UX** — `docs/design.md` is the living design system; proposals
  that keep its principles (search-first, trust is explicit, metadata
  only, no public trust scores) are welcome.
- **Code** — bug fixes, tests, and features. See below for scope.

If you're planning something larger than a small fix (a new feature, a
schema change, a new resource type beyond cards), please open an issue
first so we can align on approach before you invest the time. This also
avoids duplicate work with the maintainers' own AI agent team (see
[The Squad AI agents](#the-squad-ai-agents)).

## Before you start

Read the [Security Boundary](README.md#security-boundary) section of the
README and [`SECURITY.md`](SECURITY.md) before writing any code that
touches user data. The short version: Card Crew never stores card numbers,
CVVs, PINs, OTPs, or bank credentials, and contact details are only ever
revealed after an explicit approval step. Any PR that weakens either
guarantee will be rejected regardless of what else it does.

## Development setup

Full setup steps (prerequisites, environment variables, install, run,
verify) live in the [README](README.md#prerequisites) so they stay in one
place. In short:

```bash
npm install --prefix backend
npm install --prefix frontend

npm run dev:backend   # http://localhost:3000
npm run dev:frontend  # http://localhost:5173
```

You'll need your own Supabase project — see the README's
[Environment Setup](README.md#environment-setup) section for exactly which
keys go where. **Never commit a `.env` file**; `.env.example` is the
template that should change instead.

## Repository layout

See the [README](README.md#repository-layout) for the full breakdown.
Two things worth knowing up front:

- The project is **mid-migration** from a custom Express/Prisma API
  (`backend/`) to a Supabase-native backend (`supabase/`: PostgREST + RPC
  + Row Level Security, no application server). Check
  [issue #3](https://github.com/SriSatyaLokesh/card-crew/issues/3) and the
  README's architecture table before assuming which backend a change
  belongs in.
- `.squad/` and the AI-agent scaffolding in `.github/agents`,
  `.github/skills`, and `.github/prompts` support the maintainers'
  AI-assisted workflow (see [below](#the-squad-ai-agents)). You don't need
  to touch these to contribute code.

## Branching and commits

- Fork the repository (or branch directly if you have write access) from
  `main`.
- Branch names are your choice; a short, descriptive slug like
  `fix/network-search-depth` or `docs/architecture-diagram` is easiest to
  scan. Branches named `squad/{issue}-{slug}` are reserved for the AI
  agent workflow — please don't use that prefix for human-authored work,
  to keep the two apart in the branch list.
- Use [Conventional Commits](https://www.conventionalcommits.org/)-style
  prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. Keep
  each commit focused; it's fine to have several small commits in a PR.

## Coding standards

- **TypeScript** throughout (`backend/`, `frontend/`, `tests/integration/`).
  Keep new code typed — avoid `any` unless there's genuinely no better
  option, and say why in a comment when you do.
- Follow the patterns already in the file/module you're touching before
  introducing a new one. If you think an existing pattern should change,
  raise it in the issue or PR description rather than changing it silently
  as part of an unrelated fix.
- Frontend UI changes should follow [`docs/design.md`](docs/design.md)
  (color tokens, spacing scale, component conventions) rather than
  introducing new ad hoc styles.
- Server-side authorization and visibility checks (RLS policy in
  `supabase/`, or the equivalent guard in `backend/`) are not optional —
  see [Security and privacy contributions](#security-and-privacy-contributions).

## Testing

Run these before opening a PR — CI runs them too, but catching failures
locally is faster for everyone:

```bash
npm test
npm run build
```

If your change touches `supabase/` (schema, RLS policies, or RPC
functions), you also need the
[Supabase CLI](https://supabase.com/docs/guides/cli) and Docker:

```bash
supabase db reset
cd tests/integration
npm install
npm test
```

See [`supabase/README.md`](supabase/README.md) for what the guardrails
check and why they exist. Add or update tests whenever you change API or
RLS behavior — a behavior change without a test change is one of the more
common reasons a PR gets sent back for another pass.

## Opening a pull request

1. Fill out the PR template — it asks for what changed, why, how you
   tested it, and whether it touches the security boundary above.
2. Link the issue it closes (`Closes #123`) when there is one.
3. Keep the PR scoped to one concern. A drive-by formatting change bundled
   with a feature makes review slower, not faster — split them.
4. CI must pass: build, backend tests, and (if `supabase/` changed) the
   Supabase guardrails and integration suite. See the workflows under
   [`.github/workflows/`](.github/workflows/) for exactly what runs.
5. A maintainer (or a Squad member reviewing on a maintainer's behalf, per
   the "needs review" flag below) will review. Expect at least one round
   of feedback on anything non-trivial — that's normal, not a rejection.

## Issue types and labels

We use GitHub's built-in **issue types** alongside labels to keep the
tracker scannable:

| Issue type | Use for |
| --- | --- |
| 🐞 Bug | Something works differently than documented/expected |
| ✨ Feature | A new capability or resource type |
| 📚 Documentation | README/docs/comments are wrong, missing, or unclear |
| ❓ Question | You need clarification, not a code change (yet) |

(If your fork of GitHub's UI doesn't show issue types, or you're filing
from the API, the same categories exist as the four templates under
[`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE) — pick the matching
one and the right labels are applied automatically.)

On top of type, we use a small set of labels — see
[`.github/labels.yml`](.github/labels.yml) for the full, authoritative
list with colors and descriptions. The ones you'll see most:

- `good first issue` / `help wanted` — scoped starting points for new
  contributors.
- `area:frontend`, `area:backend`, `area:supabase`, `area:docs`,
  `area:design` — which part of the repo the issue touches.
- `priority:high` / `priority:low` — maintainer-set triage priority.
- `squad`, `squad:{member}` — **reserved for the maintainers' AI-agent
  triage workflow** (see below). Don't add these yourself; a maintainer
  applies them.

Never report a security vulnerability as a public issue — see
[`SECURITY.md`](SECURITY.md) for the private reporting process.

## The Squad AI agents

You may notice branches named `squad/{issue}-{slug}`, a bot account
(`@copilot`) commenting on issues, or a `.squad/` folder in the repo root.
This is **Squad**, an AI-agent framework the maintainers use to triage and
draft fixes for a subset of issues (documentation fixes, small isolated
features, dependency bumps, and similar well-scoped work — see
`.squad/team.md` for the exact routing rules). Architecture decisions,
security-critical changes, and anything ambiguous are explicitly routed to
a human instead.

As a contributor, this shouldn't change how you work: file issues and PRs
normally. If an issue already has a `squad:{member}` label, it likely
means an agent has already picked it up — check for a linked PR or recent
comment before duplicating the effort, or just comment to ask.

## Security and privacy contributions

Because Card Crew's entire value proposition rests on *not* handling card
secrets, PRs that touch authentication, authorization, RLS policies, or
anything under "Requests"/contact handoff get extra scrutiny. If you're
proposing a change in this area:

- Say so explicitly in the PR description.
- Explain what the change does to the approval/visibility model, not just
  what it does to the code.
- Expect a `🔴 Not suitable`-for-automation-style review — i.e., a human
  maintainer, not an automated pass.

Found an actual vulnerability rather than proposing a change? Report it
privately per [`SECURITY.md`](SECURITY.md) instead of opening a PR or
issue.

## Getting help

Open a [Question issue](.github/ISSUE_TEMPLATE/question.yml) or start a
[Discussion](https://github.com/SriSatyaLokesh/card-crew/discussions) if
enabled on the repository. There's no dumb question — if the docs didn't
answer it, that's a documentation bug on our side, not on yours.
