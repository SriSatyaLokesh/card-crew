# Product Requirements Document (PRD)
# Trusted Personal Resource Network

**Document status:** Product definition / implementation PRD  
**Initial geography:** India-first, global-ready architecture  
**Product phases:** MVP → V1 → V2 (A2UI / Agent)  
**Initial platform:** Lightweight web/mobile-responsive application; Android later based on validation

---

## 1. Executive Summary

We are building a **Trusted Personal Resource Network**: a private, permissioned network where each user is a node, trusted people are connected nodes, and each node can declare resources they own or legitimately have access to.

The first and narrowest use case is **finding a specific credit/debit card within a user's trusted network**. A user searches for or selects a card, and the system searches their network to identify people who have that card. The user can request help from the owner, who remains in control of how they fulfill the request.

The platform is deliberately **not a card-number sharing platform**. It does not require or centrally store card numbers, CVVs, PINs, OTPs, bank credentials, or other authentication secrets. RBI guidance says cardholders should not lend their card or share PINs; therefore the product boundary is discovery, permission, request, and owner-controlled fulfillment rather than credential exchange. [RBI FAQ](https://www.rbi.org.in/scripts/FS_FAQs.aspx?Id=75)

Over time, the same network model expands to other resources such as card offers, coupons, vouchers, airport lounge access, eligible memberships/subscription access, OTT access where the provider permits sharing, and eventually other shareable resources.

The long-term product is therefore not a "card sharing app". It is a **social graph of trusted people and their usable resources/benefits**.

---

## 2. Product Thesis

### The problem

People regularly need something that someone they know already has:

- A specific credit/debit card to qualify for an offer.
- A card that gives a discount on Amazon, Flipkart, travel, dining, etc.
- Airport lounge access or an eligible guest entitlement.
- An unused coupon, gift card, or voucher.
- A legitimately shareable subscription slot or membership benefit.
- In the future, other digital or physical resources.

The problem is not lack of resources. The problem is **lack of visibility across a trusted network**.

Today the discovery process is fragmented across WhatsApp groups, phone calls, spreadsheets, notes, coupon sites, and memory.

### The solution

Build a trusted graph where:

> **People declare what they have → the network indexes it → people search for what they need → the app finds trusted matches → the owner decides how to help.**

### Core product promise

> **Find what you need through people you trust.**

---

## 3. Product Principles

1. **Network first, card second.** Cards are the first resource category, not the product definition.
2. **Metadata, not secrets.** The network stores resource metadata; sensitive credentials are never required centrally.
3. **Owner control.** Ownership does not mean automatic sharing. Every request requires the owner's decision.
4. **Trust-aware discovery.** Relationship distance and user-controlled visibility determine what can be discovered.
5. **Search before automation.** Build reliable APIs and deterministic search first; put an LLM agent on top later.
6. **Lightweight first.** Prove the network/search loop before building payments, marketplaces, native apps, or sophisticated AI.
7. **Provider/rule aware.** A resource is only shareable through a mechanism permitted by its issuer/provider and applicable rules.
8. **Global-ready data model.** Country, issuer, currency, network, benefit and policy metadata must not assume India-only behavior, even though the initial launch is India-first.

---

## 4. Target Users

### Primary user

A digitally active consumer who:

- Has multiple cards/benefits.
- Shops online frequently.
- Has friends/family/colleagues with different cards and benefits.
- Frequently asks, "Does anyone have this card?"
- Wants to save money or unlock access without applying for another card/subscription.

### Secondary user

A resource owner who:

- Has benefits they do not always use.
- Is willing to help trusted people.
- Wants to control exactly who can discover/request something.

### Future users

- Families.
- Travel groups.
- Student communities.
- Employee/friends circles.
- Frequent shoppers.
- Digital subscription groups.
- Communities organized around hobbies or shared resources.

---

## 5. User Jobs To Be Done

### Job 1 — Find a card

> "I need HDFC Infinia. Does anyone in my network have it?"

### Job 2 — Find the right card for an offer

> "Amazon has these offers. Which eligible card is available in my network?"

### Job 3 — Find a benefit

> "I need airport lounge access. Who can help?"

### Job 4 — Make an unused resource useful

> "I have an Amazon voucher/coupon I will not use. Can someone in my network use it?"

### Job 5 — Ask a trusted person for help

> "I found the owner. Let me send a request and let them decide."

### Job 6 — Avoid repeated searching

> "I use certain resources often; keep my own resource metadata organized so I can quickly select/share relevant information myself."

---

## 6. Scope by Phase

| Capability | MVP | V1 | V2 / A2UI |
|---|---:|---:|---:|
| User account/profile | ✅ | ✅ | ✅ |
| Add/accept friends | ✅ | ✅ | ✅ |
| Personal graph | ✅ | ✅ | ✅ |
| Card catalog | ✅ | ✅ | ✅ |
| Add credit/debit cards | ✅ | ✅ | ✅ |
| Card metadata search | ✅ | ✅ | ✅ |
| Search friends' card holdings | ✅ | ✅ | ✅ |
| Relationship distance | Basic | Full | Full |
| Search by merchant/platform | — | ✅ | ✅ |
| Offer-to-card mapping | — | ✅ | ✅ |
| Product-link analysis | — | Later V1.x | ✅ |
| Coupons/vouchers | — | ✅ | ✅ |
| Lounge/pass resources | — | ✅ | ✅ |
| Requests + owner approval | ✅ | ✅ | ✅ |
| Contact handoff | Basic | ✅ | ✅ |
| Fine-grained privacy | Basic | ✅ | ✅ |
| Local encrypted personal vault | Optional / constrained | ✅ where legally/security appropriate | ✅ |
| OTT/subscription resources | — | Design only | ✅ when permitted |
| Marketplace/payment settlement | — | — | Future |
| LLM agent | — | — | ✅ |
| A2UI | — | — | ✅ |

---

# 7. MVP — Better CardCircle

## 7.1 MVP Goal

Validate one hypothesis:

> **If people explicitly build a trusted network and declare their cards, users will search that network when they need a card and act on the resulting matches.**

MVP should be lightweight and fast. Do not build a marketplace, AI agent, payments, OTT, or complex offer engine yet.

## 7.2 MVP Features

### A. User onboarding

- Phone/email-based account creation.
- Basic profile.
- User can add trusted friends.
- Friend relationship requires explicit acceptance.
- User can remove/block connections.

### B. Card catalog

Maintain a canonical catalog with:

- Issuer/bank.
- Product/card name.
- Card type: credit/debit.
- Network: Visa/Mastercard/RuPay/Amex/etc.
- Tier/variant where applicable: Platinum/Signature/Infinite/etc.
- Country/market.
- Active/inactive status.

### C. Add my cards

User selects from the catalog rather than manually creating free-form card names where possible.

Example:

```text
HDFC Bank
  HDFC Infinia
  HDFC Regalia Gold

Axis Bank
  Axis Atlas
  Axis Magnus

American Express
  Platinum
  Gold
```

User can choose whether a resource is discoverable by their network.

### D. Network search

Primary flow:

```text
User
  ↓
Search/select card
  ↓
Search trusted graph
  ↓
Return matching people
  ↓
Show relationship distance
  ↓
Request help
```

Example result:

```text
HDFC Infinia

Rahul      Direct friend
Priya      Friend of friend via Rahul
```

### E. Resource-owner request

Requester selects a person and sends:

> "I need help with HDFC Infinia for an offer."

Owner receives the request and can:

- Approve.
- Decline.
- Ignore.
- Contact requester.

### F. Contact handoff

The platform should enable the owner/requester to move to a trusted communication channel, such as phone/WhatsApp, according to privacy settings.

The platform should not automatically reveal private contact details before the owner's permission where such disclosure is not already public/authorized.

### G. Basic graph UI

The user can see:

- Self node.
- Direct friends.
- Resource count per person.
- Matching resource highlighted.

The graph should support discovery but not become a heavy visualization dependency. The primary navigation remains search.

---

# 8. V1 — Complete Manual Trusted Resource Network

## 8.1 V1 Goal

Expand the validated card graph into a broader manual-search network covering **cards, offers, coupons, vouchers and access/benefit resources**.

## 8.2 Resource categories

### Financial/payment metadata

- Credit cards.
- Debit cards.
- Card network/type metadata.
- Card-linked merchant offers.

### Benefits/access

- Airport lounge access.
- Eligible guest access.
- Travel benefits.
- Hotel/membership benefits.
- Other issuer-provided privileges.

### Commercial value

- Coupons.
- Promo codes.
- Gift cards/vouchers.
- Store-specific offers.
- Other legitimately transferable promotional value.

### Subscription/access

Design the resource model so OTT, music, software, memberships and family-plan entitlements can be added later, subject to each provider's rules.

## 8.3 Merchant/platform search

User can search:

> Amazon

The platform returns known offers/cards associated with the merchant and then searches the user's network.

Example:

```text
Amazon

Relevant offers
  HDFC Infinia
  Axis Atlas
  ICICI Emeralde

Available in your network
  Rahul - HDFC Infinia
  Priya - ICICI Emeralde
```

## 8.4 Offer → Card → Person flow

The search engine must support:

```text
Offer
  ↓
Eligible card products
  ↓
People who own those cards
  ↓
Trust distance
  ↓
Request
```

## 8.5 Product-link flow (V1.x / preparation for V2)

A user provides a product URL.

Target future behavior:

```text
Product URL
  ↓
Identify merchant/product
  ↓
Identify known offers
  ↓
Identify eligible cards
  ↓
Search trusted network
  ↓
Rank matches
```

Do not make arbitrary web scraping a core MVP dependency. Start with curated/structured merchant and offer data and add automated extraction later.

## 8.6 Search modes

V1 should offer three entry points:

### Search a card

> "HDFC Infinia"

### Search a platform/merchant

> "Amazon"

### Search a benefit/resource

> "Airport lounge"

---

# 9. V2 — A2UI / Agent-First Experience

## 9.1 Architecture principle

**API first. Agent second.**

All core functionality must exist behind deterministic APIs before the LLM is introduced.

Today:

```text
Manual UI
   ↓
API
   ↓
Graph + resource database
   ↓
Search results
```

V2:

```text
User request
   ↓
LLM agent
   ↓
Structured tool/API calls
   ↓
Graph + resource database + offer system
   ↓
A2UI response
```

## 9.2 Example agent request

> "I'm buying this phone on Amazon. Find the best offer available through my network."

Agent tasks:

1. Parse product/merchant.
2. Identify applicable offers.
3. Identify eligible cards/resources.
4. Search network.
5. Apply relationship/visibility rules.
6. Rank results.
7. Present results through A2UI.
8. Initiate a request if the user chooses one.

## 9.3 Why API-first matters

- Deterministic behavior.
- Testable search logic.
- LLM can be replaced without rebuilding business logic.
- Mobile/web/partner clients can reuse the same API.
- Stronger security boundaries.
- Better observability and auditing.

---

# 10. Core User Flows

## Flow A — Add a card

```text
Sign in
  ↓
My resources
  ↓
Add card
  ↓
Search/select issuer
  ↓
Select card
  ↓
Set visibility
  ↓
Save
```

## Flow B — Find a card

```text
Search
  ↓
Select card
  ↓
Search my graph
  ↓
Matching nodes
  ↓
Open person
  ↓
Request help
```

## Flow C — Owner approves

```text
Request received
  ↓
Owner sees requester + relationship
  ↓
Approve / Decline
  ↓
If approved, permitted contact/share path is revealed
```

## Flow D — Search an offer

```text
Search merchant
  ↓
Offers
  ↓
Eligible cards
  ↓
Search network
  ↓
Rank by trust + relevance + availability
```

## Flow E — Share a coupon/voucher in V1

```text
Add voucher/coupon
  ↓
Mark shareable
  ↓
Set visibility + expiry
  ↓
Network discovers it
  ↓
Requester sends request
  ↓
Owner approves
  ↓
Owner fulfills through permitted mechanism
```

---

# 11. Trust Graph

## 11.1 Graph structure

```text
User
  ├── Friend
  │     ├── Friend
  │     └── Friend
  └── Friend
```

Each connection has:

- Status: pending/accepted/blocked.
- Relationship type/group.
- Creation date.
- Optional trust settings.

## 11.2 Search depth

MVP:
- Direct friends.

V1:
- Direct friends + optional second degree.
- Maximum search depth configured by the product/user.

Future:
- N-degree search subject to privacy and performance constraints.

## 11.3 Ranking

Rank search results by:

1. Direct relationship.
2. Stronger trust relationship/group.
3. Resource availability.
4. Resource match quality.
5. Previous successful interactions.
6. Response/reliability signals.
7. Distance only as a secondary factor.

Do not make a public financial/credit-like "trust score." The concept should remain social/reliability-oriented.

---

# 12. Privacy Model

Privacy is a core product feature, not a compliance add-on.

## 12.1 Visibility levels

A resource may be visible to:

- Only me.
- Direct friends.
- Friends of friends.
- My trusted network.

Visibility must be configured per resource category and eventually per individual resource.

## 12.2 Discovery vs request vs contact

These are separate permissions.

Example:

```text
Can discover: Yes
Can see resource name: Yes
Can request: Yes
Can see contact details: No
Can contact after owner approval: Yes
```

## 12.3 Social graph privacy

Do not expose unnecessary graph edges.

A search result may say:

> "2nd-degree connection via Rahul"

without exposing the entire social graph.

## 12.4 Minimal contact permissions

The app should not require address-book upload as the default architecture.

Preferred model:

```text
Invite
  ↓
Accept
  ↓
Friendship
  ↓
Explicit trust relationship
```

Privacy-preserving contact matching can be considered later if needed.

---

# 13. Security & RBI Boundary

## 13.1 What the central platform stores

Safe resource metadata such as:

```text
user_id
resource_id
issuer_id
product_id
resource_type
network
variant
benefit_ids
visibility
availability
country
currency
expiry
requestability
provider_policy_id
```

## 13.2 What the central platform must not require

Never require or centrally store:

- Full card number.
- CVV.
- PIN.
- OTP.
- Bank login credentials.
- UPI PIN.
- Internet banking password.
- OTT passwords.
- Other authentication secrets.

RBI says cardholders should not lend cards or share PINs. The application must therefore be positioned around discovery and controlled assistance, not physical card/credential lending. [RBI](https://www.rbi.org.in/scripts/FS_FAQs.aspx?Id=75)

## 13.3 Local personal vault

Users may eventually want to keep their own card information for personal convenience. This is separate from the social network.

Preferred architecture:

- Opt-in only.
- Device-local encrypted storage.
- OS-backed secure key storage where available.
- Biometric/passcode unlock.
- No server-side plaintext storage.
- Never include secrets in analytics/logging/crash reports.
- Copy/share only after local authentication.

The initial MVP should avoid building this capability until the security/compliance model is reviewed. Card metadata alone is sufficient to prove the network concept.

## 13.4 Owner-controlled sharing

The owner—not the platform—decides how the resource is fulfilled.

Examples:

**Card offer:** owner may coordinate the purchase/payment themselves.

**Lounge:** owner may provide eligible guest access through the issuer's permitted mechanism.

**Coupon/voucher:** owner transfers it only where terms allow.

**OTT:** use the provider's official family/extra-member mechanism where available; never instruct users to share passwords where prohibited.

## 13.5 Rule engine

Every resource type should have a policy record:

```text
DISCOVERABLE
REQUESTABLE
TRANSFERABLE
LENDABLE
SELLABLE
EXPIRABLE
LOCATION_RESTRICTED
RELATIONSHIP_RESTRICTED
PROVIDER_RULES
```

This prevents the application from treating every resource as freely transferable.

---

# 14. Resource Data Model

The core domain model should be generic enough to expand.

```text
User
  ↓
Relationship
  ↓
Resource
  ↓
Benefit
  ↓
Policy
  ↓
Availability
```

## Resource

Potential fields:

```text
resource_id
owner_id
resource_type
provider_id
product_id
country
currency
metadata
visibility
availability_status
expiry_at
request_enabled
policy_id
created_at
updated_at
```

## Benefit

```text
benefit_id
benefit_type
merchant_id
description
eligibility_rules
value_type
value
valid_from
valid_to
country
```

## Relationship

```text
relationship_id
user_id
connected_user_id
status
relationship_group
visibility_scope
created_at
```

## Request

```text
request_id
requester_id
owner_id
resource_id
message
status
created_at
responded_at
```

---

# 15. API Requirements

The API layer should be designed before the agent layer.

### Identity

```http
POST /users
GET /users/me
PATCH /users/me
```

### Relationships

```http
POST /relationships
GET /relationships
PATCH /relationships/{id}
DELETE /relationships/{id}
```

### Resource catalog

```http
GET /catalog/cards
GET /catalog/cards/{id}
GET /catalog/merchants
GET /catalog/benefits
```

### Personal resources

```http
POST /resources
GET /resources/me
PATCH /resources/{id}
DELETE /resources/{id}
```

### Search

```http
GET /search/cards?q=
GET /search/network?resource_id=
GET /search/merchants?q=
GET /search/benefits?q=
```

### Requests

```http
POST /requests
GET /requests/incoming
GET /requests/outgoing
PATCH /requests/{id}
```

Future agent tools can call these deterministic endpoints.

---

# 16. Search Requirements

## MVP search

Input:

- Canonical card ID.
- User ID.

Output:

```json
{
  "resource": "HDFC Infinia",
  "matches": [
    {
      "user": "Rahul",
      "relationship": "direct",
      "requestable": true
    }
  ]
}
```

## V1 search

Support:

- Card.
- Merchant/platform.
- Benefit.
- Coupon/voucher.
- Resource type.

The search API should return normalized resource identifiers rather than relying entirely on free-text matching.

---

# 17. UI / UX Requirements

## 17.1 Home

The home screen should answer two questions immediately:

> **What do you have?**

> **What do you need?**

Primary actions:

```text
[ Search your network ]
[ My resources ]
[ My network ]
```

## 17.2 Search-first experience

Search is the primary interaction, not graph navigation.

Example:

```text
Search cards, benefits, offers...

HDFC Infinia
```

Results immediately show network matches.

## 17.3 Graph view

The graph is a contextual visualization:

```text
Friend A ─── YOU ─── Friend B
                │
             Friend C
```

Selecting a resource highlights relevant nodes.

Example:

```text
Search: HDFC Infinia

         Rahul
           ●
          /
         /
       YOU ●──── Priya
```

## 17.4 Resource card

A resource card should show only what is needed:

```text
HDFC Infinia
HDFC Bank · Credit · Visa

Owned by Rahul
Direct friend

[Request help]
```

Do not display sensitive card details.

---

# 18. Notifications

MVP:

- Friend request.
- Resource request.
- Request approved/declined.

V1:

- Expiring voucher/coupon.
- New resource match.
- Someone added a resource frequently searched by the user.
- Request response reminders.

Future:

- "Someone in your network can help with this."
- Agent-generated proactive suggestions.

---

# 19. Non-Goals

The following are explicitly out of MVP:

- Central storage of card credentials.
- Card payment processing.
- Card credential lending.
- OTP/PIN sharing.
- Banking login integration.
- Money transfer infrastructure.
- Escrow.
- Open anonymous marketplace.
- OTT password sharing.
- Automated issuer account access.
- Native Android app before web/lightweight validation.
- LLM agent before APIs/search are stable.

---

# 20. Competitive Positioning

## CardCircle

**Observed positioning:** a credit-card directory for trusted contacts; users can search for a card and identify which trusted contact has it. It intentionally keeps the scope lightweight and uses the social/contact layer to connect people.

**What we learn:** proves the initial job-to-be-done.

**Our extension:** generic trusted resource graph + benefits/offers + relationship permissions + requests + future resources.

## benefix / benny

benefix positions itself around shopping offers, cashback, promo codes, coupons and credit-card offers, including seeing offers available on friends' cards. citeturn649740search0

**What we learn:** users want merchant/product-led discovery rather than only card-led discovery.

**Our extension:** keep the network as the primary system and make merchant/offer discovery another entry point into that network.

## Xare

Xare goes substantially further into controlled card access and payment use. It promotes club-based card pooling, requests for members' cards, and card sharing without revealing underlying card details. citeturn649740search1turn649740search2

**What we learn:** there is demand for trusted-network card assistance and controlled access.

**Our deliberate difference:** do not make payment access the foundation. Remain primarily a discovery/trust/request network, with provider- and regulation-aware fulfillment.

## Strategic position

```text
CardCircle → Which friend has this card?
benefix    → What offers are available?
Xare       → How can someone use/share payment access?

Our product → Who in my trusted network can help me get what I need?
```

---

# 21. Why This Can Become Much Bigger

The network abstraction is reusable.

```text
                TRUSTED NETWORK
                       │
     ┌─────────────────┼─────────────────┐
     ↓                 ↓                 ↓
   PEOPLE           RESOURCES         BENEFITS
     │                 │                 │
     └─────────────────┼─────────────────┘
                       ↓
                    SEARCH
                       ↓
                    REQUEST
                       ↓
               OWNER APPROVAL
                       ↓
             LEGITIMATE FULFILLMENT
```

A card is just one resource.

Future resource types can include:

- Cards.
- Offers.
- Coupons.
- Vouchers.
- Lounge access.
- Memberships.
- Eligible OTT/family-plan access.
- Music/software subscriptions.
- Travel benefits.
- Event access.
- Other digital or physical resources where sharing/lending is permitted.

The same graph/search/request architecture handles all of them.

---

# 22. Product Differentiation

## 1. Network-native

The product is built around relationships, not around a financial account.

## 2. Resource-native

The domain model is broader than cards from day one.

## 3. Benefit-aware

The system can go from:

```text
Product → Offer → Card → Person
```

and eventually:

```text
Need → Benefit → Resource → Trusted person
```

## 4. Owner-controlled

Finding a resource never implies automatic access.

## 5. Privacy-first

No requirement to centralize payment/subscription secrets.

## 6. API-first / agent-ready

The same APIs power manual UI today and the A2UI agent tomorrow.

## 7. Trust distance

A useful result is not merely "someone has it"; it is "someone you trust has it."

---

# 23. MVP Success Metrics

The MVP should optimize for network/search behavior, not revenue.

### Activation

- % of new users who add at least 3 resources/cards.
- % who create/accept at least 3 relationships.

### Search

- Searches per active user.
- % of searches that return at least one network match.
- Time from search to useful match.

### Network value

- Average resources per active node.
- Average direct connections per active node.
- % of users with at least one useful second-degree match.

### Request behavior

- Search → request conversion.
- Request acceptance rate.
- Median owner response time.
- Successful interaction rate.

### Retention

- Weekly active users.
- Repeat search rate.
- 7-day and 30-day retention.

The most important MVP metric is:

> **When a user needs a card, do they successfully find a trusted person who can help?**

---

# 24. Key Product Trade-offs

## Trade-off 1 — Manual catalog vs open text

**Choice:** curated card catalog first.

**Why:** better search accuracy, easier deduplication, cleaner analytics, easier future API integration.

## Trade-off 2 — Metadata vs credential storage

**Choice:** metadata-only centrally.

**Why:** materially reduces security exposure and keeps the product away from the core risk of credential sharing.

## Trade-off 3 — Direct friends vs multi-hop graph

**Choice:** direct friends in MVP, second degree in V1.

**Why:** smaller privacy/performance surface while proving the core network loop.

## Trade-off 4 — Graph-first vs search-first UX

**Choice:** search-first, graph-supported.

**Why:** users have a goal such as "find HDFC Infinia"; graph exploration is useful context but slower as a primary task.

## Trade-off 5 — Marketplace vs discovery

**Choice:** discovery/request first.

**Why:** marketplace/payment introduces regulation, fraud, disputes and operational complexity before the network has proven value.

## Trade-off 6 — AI now vs later

**Choice:** API-first; AI in V2.

**Why:** business logic must remain deterministic and testable.

## Trade-off 7 — Native mobile vs lightweight app

**Choice:** lightweight web/mobile-responsive first, Android later.

**Why:** validate product behavior before committing to native complexity.

---

# 25. MVP Release Acceptance Criteria

The MVP is ready when all of the following work end-to-end:

1. A user can register.
2. A user can add/accept a friend.
3. A user can select cards from a canonical catalog.
4. A user can mark card metadata as visible to their network.
5. A user can search/select a specific card.
6. The backend searches the user's relationship graph.
7. Matching friends are returned with relationship distance.
8. User can request help from a matching owner.
9. Owner can approve/decline.
10. Contact/share handoff works without revealing central card credentials.
11. No card number/CVV/PIN/OTP is required for the network use case.
12. User can remove a resource or friendship.
13. Privacy settings are enforced server-side, not only in UI.
14. Search and request operations are auditable.
15. Core API endpoints are documented and testable independently from the UI.

---

# 26. V1 Release Acceptance Criteria

In addition to MVP:

1. Users can add coupons/vouchers/benefits.
2. Users can search by merchant/platform.
3. Merchant offers map to eligible card products/resources.
4. Search can traverse the allowed second-degree graph.
5. Results are ranked by relationship/trust and availability.
6. Owners can control discoverability/requestability per resource.
7. Expiry is supported where relevant.
8. Requests support richer context.
9. Resource policies prevent invalid transfer/share flows.
10. Product-link ingestion is architecturally supported even if only curated URLs are enabled initially.

---

# 27. V2 / A2UI Acceptance Criteria

1. Agent can interpret natural-language user intent.
2. Agent can call search/catalog/network/request APIs.
3. Agent cannot bypass privacy rules.
4. Agent cannot directly access secrets.
5. All business decisions remain enforced by APIs/backend.
6. A2UI can render search results, network matches, benefit comparisons and request actions.
7. User can ask compound requests such as:

> "Find the best Amazon offer for this product within my trusted network."

8. The agent can explain why each match was found.
9. The user remains the decision-maker before any request or fulfillment action.

---

# 28. Future Evolution

The strategic roadmap is:

```text
MVP
Better CardCircle
    ↓
V1
Trusted Card + Benefits Network
    ↓
V1.x
Offers + Coupons + Vouchers + Access
    ↓
V2
Agent / A2UI Trusted Resource Network
    ↓
Future
Global Trusted Personal Resource Network
```

Long-term, the system becomes a graph of:

```text
PEOPLE
  ↕
TRUST RELATIONSHIPS
  ↕
RESOURCES
  ↕
BENEFITS / CAPABILITIES
  ↕
NEEDS
```

The fundamental question changes from:

> "Who has this card?"

to:

> **"Who in my trusted network can help me get what I need?"**

That is the core strategic distinction and the basis for expanding far beyond cards.

---

# 29. Recommended Initial Build Order

### Step 1 — Foundation

- User identity.
- User graph.
- Friend requests.
- Privacy model.

### Step 2 — Card domain

- Card catalog.
- Add/remove cards.
- Visibility.

### Step 3 — Search API

- Card lookup.
- Network traversal.
- Relationship-aware results.

### Step 4 — Request workflow

- Request.
- Owner approval.
- Contact handoff.

### Step 5 — Lightweight UI

- Home.
- Search.
- Results.
- Person/resource view.
- Request inbox/outbox.
- Basic graph.

### Step 6 — V1 resource expansion

- Offers.
- Merchant search.
- Coupons.
- Vouchers.
- Lounge/benefits.

### Step 7 — Agent layer

- Tool/API definitions.
- Intent parsing.
- A2UI components.
- Guardrails.

---

# 30. Final Product Definition

> **A Trusted Personal Resource Network is a privacy-first social graph that lets people declare what they have, discover resources and benefits available through people they trust, and request legitimate help or access from the owner—without requiring the platform to centralize sensitive credentials. It starts with credit/debit card discovery, then expands to offers, coupons, vouchers, lounge benefits, memberships, permitted subscription access and other resources. The manual product is API-first so an agent/A2UI experience can later perform the same operations conversationally.**

The product wins by building the **network**, not by owning the card, payment, OTT or coupon itself.
