# BUILD PLAN

## 1) Recommended tech stack

**Decision:** Node.js + Express + TypeScript + Prisma + PostgreSQL 16, hosted on Render (app) + Neon (DB).

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (mobile-responsive SPA/Next.js later if SSR needed) | Matches team Node.js preference, same language across stack. |
| Backend | Node.js + Express + TypeScript | Boring/proven REST API layer, type-safe, one language across FE/BE. |
| ORM | Prisma | Deterministic schema + migrations, good fit for the relational data model. |
| Database | PostgreSQL 16 | Strong fit for users, relationships, catalog, visibility rules, and request workflows. |
| Hosting | Render + Neon | Managed, low-ops, cheap enough for MVP, easy to replace later if needed. |

**Why this stack (MVP-first):**
- One primary language (TypeScript) across frontend and backend keeps the team fast.
- Express + Prisma gives deterministic REST APIs before any automation layer.
- No premature infra complexity; easy path from MVP to V1/V2.

---

## 2) High-level architecture

### API-first boundary

```text
Mobile-responsive web UI
  ↓
REST API (users, relationships, catalog, resources, search, requests)
  ↓
Domain services (privacy, graph traversal, ranking, request workflow)
  ↓
PostgreSQL
```

- UI is a client of the same API contract future agent tools will use.
- Keep business rules server-side: visibility, requestability, contact handoff, audit logging.
- Use Django admin only for internal catalog/support operations, not as the product UX.

### Hard product boundary

**Never store or require:** full card number, CVV, PIN, OTP, bank credentials, UPI PIN, internet-banking passwords, OTT passwords.  
**Store only:** metadata, visibility, request permissions, policy, and request history.

### Data model summary

| Entity | MVP purpose | Core fields |
|---|---|---|
| User | Account + profile | id, email/phone, display_name, status, created_at |
| Connection / Friend | Trusted graph edge | id, user_id, connected_user_id, status, relationship_group, created_at |
| CardCatalog | Canonical card list | id, issuer, product_name, card_type, network, variant, country, active |
| Resource | Generic owner-held thing | id, owner_id, resource_type, catalog_ref, availability_status, request_enabled |
| UserCard | MVP card holding (Resource subtype) | id, owner_id, card_catalog_id, visibility_rule_id, notes_optional |
| VisibilityRule | Discovery/request/contact controls | id, discover_scope, request_scope, contact_scope |
| Request | Ask owner for help | id, requester_id, owner_id, resource_id, message, status, created_at, responded_at |

### Phase map: MVP → V1 → V2

| Slice | MVP | V1 | V2 |
|---|---|---|---|
| Graph depth | Direct friends only | Optional 2nd degree | Same APIs, agent consumes them |
| Resources | Cards only | Cards + coupons + vouchers + lounge/benefit resources | Full trusted resource graph |
| Search entry | Search by canonical card | Card + merchant + benefit + offer mapping | Natural language → structured API calls |
| Privacy | Basic discover/request/contact rules | Finer per-resource controls | Same rules; agent cannot bypass |
| Request flow | Request + approve/decline + contact handoff | Richer context + expiry/policy handling | Agent-assisted request initiation |
| UI model | Search-first manual UI | Broader manual trusted-resource UI | A2UI / agent-first experience |

---

## 3) MVP backlog

**Execution order:** Lead scope/API decisions → Backend foundation + UX wireframes → Frontend thin flows → Tester release gates.

### Lead

| Seq | Task |
|---|---|
| L1 | Freeze MVP scope to: direct friends, canonical card catalog, card search, request flow, basic privacy, basic contact handoff. |
| L2 | Publish the REST contract for `/users`, `/relationships`, `/catalog/cards`, `/resources`, `/search/network`, and `/requests`. |
| L3 | Approve the MVP data model and name the card-only implementation as `UserCard` on top of generic `Resource`. |
| L4 | Define the server-side permission matrix for discover vs request vs contact, limited to direct-friend rules in MVP. |
| L5 | Sign off the release checklist against PRD MVP acceptance criteria and cut any non-MVP work before build freeze. |

### Backend

| Seq | Task |
|---|---|
| B1 | Scaffold Node.js + Express + TypeScript project, Prisma/PostgreSQL connection, environment config, and `/health` endpoint. |
| B2 | Implement user accounts and basic profile API with audit-safe fields only. |
| B3 | Implement friend invite/accept/remove/block APIs and persist connection status transitions. |
| B4 | Create `CardCatalog`, seed an initial curated catalog, and expose searchable read-only card endpoints. |
| B5 | Create `Resource`, `UserCard`, and `VisibilityRule` models plus CRUD APIs for “My Cards.” |
| B6 | Implement direct-friend network search by canonical `card_catalog_id` and return relationship label + requestable flag. |
| B7 | Implement request create/incoming/outgoing/respond APIs with approve/decline/ignore states. |
| B8 | Implement basic contact handoff rules so owner approval gates any direct contact reveal. |
| B9 | Enforce privacy checks server-side for hidden cards, blocked users, and non-friend access. |
| B10 | Add API tests for onboarding, friendship, add-card, search-match, request flow, and privacy denial paths. |

### Frontend

| Seq | Task |
|---|---|
| F1 | Build a mobile-first app shell with auth entry, nav, and signed-in home screen. |
| F2 | Build “My Network” screens for invite, accept, remove, and block actions. |
| F3 | Build “My Cards” screens to search the catalog, add a card, and set basic visibility. |
| F4 | Build the search-first home flow with card search/select and empty states. |
| F5 | Build search results that show matching people, direct-friend badge, and request action. |
| F6 | Build request compose, incoming/outgoing request lists, and owner approve/decline actions. |
| F7 | Build a lightweight graph/context view that highlights only self + direct friends + matching resource count. |
| F8 | Add loading, error, success, and no-match states for all MVP flows. |

### UX

| Seq | Task |
|---|---|
| U1 | Produce low-fi mobile-first wireframes for Home, My Cards, My Network, Search Results, and Requests. |
| U2 | Define the shortest onboarding flow that gets a user to add 1 friend and 1 card in one session. |
| U3 | Write privacy and trust copy for visibility, request permission, contact handoff, block, and decline states. |
| U4 | Define result labels for “Direct friend,” “Can request,” “Hidden until approval,” and “No match.” |
| U5 | Review implemented screens for clarity, accessibility basics, and scope creep before MVP sign-off. |

### Tester

| Seq | Task |
|---|---|
| T1 | Convert PRD MVP acceptance criteria into a release checklist with pass/fail evidence. |
| T2 | Write happy-path test cases for register/login, add friend, accept friend, add card, search card, send request, approve request. |
| T3 | Write negative/privacy tests for hidden cards, blocked users, non-friend search, and unauthorized contact reveal. |
| T4 | Verify forms, APIs, logs, and fixtures never contain card number, CVV, PIN, OTP, or bank credentials fields. |
| T5 | Run mobile-browser smoke tests for the full search-to-request loop and record defects by severity. |

---

## 4) Explicitly out of scope for MVP

Do **not** build these in MVP:

- Marketplace or open buyer/seller exchange
- Payments, escrow, settlements, or money-transfer flows
- LLM agent / A2UI
- OTT or subscription-sharing features
- Product-link scraping or arbitrary merchant-page scraping
- Card-number vaults, credential storage, or banking integrations
- 2nd-degree graph traversal
- Merchant/offer search engine
- Native Android app

---

## 5) MVP release guardrails

- Search-first, not graph-first.
- Metadata and permission only; never secrets.
- Direct friends only in MVP.
- Deterministic APIs before any automation layer.
- If a feature does not improve **find card → request owner → owner decides**, cut it to V1+.
