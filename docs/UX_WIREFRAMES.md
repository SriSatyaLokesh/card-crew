# Card Crew MVP UX Wireframes

Status: U1-U5 complete
Audience: Frontend implementation and release testing

## Design Principles

- Search is the primary action; the graph supports search instead of becoming the home screen.
- Discovery, requesting, and contact handoff are separate permissions and separate UI states.
- Never display card numbers, CVVs, PINs, OTPs, bank credentials, or other secrets.
- A direct-friend relationship is visible as context, not as a public trust score.
- Contact details remain hidden until the owner approves the request.

## U1: Low-Fi Screens

The layouts below are mobile-first. On wider screens, the content column can expand while the primary action remains reachable without scrolling.

### Home / Search

```text
+--------------------------------+
| Card Crew                 [..] |
| Find help from people you trust|
|                                |
| [ Search a card...          ]  |
|                                |
| Recent searches                |
| HDFC Infinia                   |
|                                |
| [ My Cards ] [ Network ]       |
| [ Requests ]                   |
+--------------------------------+
```

Primary action: focus the card search field.
Empty state: "Search a card to see whether a direct friend can help."

### My Cards

```text
+--------------------------------+
| < Back       My Cards       [+] |
|                                |
| HDFC Infinia                   |
| Visible to: Direct friends     |
| Requests: Allowed              |
|                                |
| Axis Atlas                     |
| Visible to: Only me            |
| Requests: Off                  |
|                                |
| [+ Add a card]                 |
+--------------------------------+
```

Add/edit controls must show discovery, request, and contact permissions separately. Contact permission is not enabled by adding a card; it is handled by request approval.

### My Network

```text
+--------------------------------+
| < Back       My Network      [+]|
|                                |
| [ Invite a friend            ]  |
|                                |
| Direct friends                 |
| Rahul                          |
| Connected                      |
|                                |
| Pending invitations            |
| Priya       [Accept] [Decline] |
|                                |
| Blocked                         |
| 0 people                       |
+--------------------------------+
```

Only direct relationship state is shown. Do not render a full graph or expose unrelated connection edges.

### Search Results

```text
+--------------------------------+
| < Back       HDFC Infinia      |
|                                |
| 2 direct friends can help      |
|                                |
| Rahul                          |
| Direct friend                 |
| Can request                    |
| [Request help]                |
|                                |
| Priya                          |
| Direct friend                 |
| Hidden until approval          |
| [Request unavailable]          |
|                                |
| No match? Invite a trusted     |
| friend to join Card Crew.     |
+--------------------------------+
```

A private resource does not appear. A visible resource with requests disabled may appear only when discovery is allowed, with no request action.

### Requests

```text
+--------------------------------+
| Requests                       |
| [Incoming] [Outgoing]          |
|                                |
| Incoming                      |
| Anil wants help with Atlas     |
| Direct friend                 |
| [Approve] [Decline] [Ignore]   |
|                                |
| Approved                       |
| HDFC Infinia request           |
| Contact details available      |
| [View contact]                |
+--------------------------------+
```

Before approval, never show private contact fields. After approval, show only the contact fields permitted by the user's profile and the approved handoff state.

## U2: Shortest Onboarding Flow

Goal: reach one friend and one card in a single session.

```text
Sign in
  -> Add display name if needed
  -> Invite or accept one friend
  -> Add one card from the canonical catalog
  -> Choose discovery scope: Only me / Direct friends
  -> Land on Home search
```

Rules:

- Do not require card details or financial credentials.
- Do not force a full profile wizard before search.
- If the user skips adding a card, Home remains usable for searching the network.
- If the user has no friend yet, show Invite a friend as the next action after card setup.
- Preserve the user's selected visibility; default new cards to Direct friends.

## U3: Privacy and Trust Copy

### Visibility

- Only me: "Only you can discover this card."
- Direct friends: "Your direct friends can discover this card."
- Network: "People in your trusted network may discover this card."

### Request permission

- Enabled: "Direct friends can ask you for help. You decide every request."
- Disabled: "People may discover this card, but they cannot send a request."
- Private card: "Private cards cannot be discovered or requested."

### Contact handoff

- Before approval: "Contact details stay hidden until the owner approves the request."
- Approved: "The owner approved this request. You can now use the permitted contact path."
- Declined: "The owner declined this request. Contact details remain hidden."
- Ignored: "This request was not answered. Contact details remain hidden."

### Block and decline

- Block confirmation: "Blocking removes this connection and prevents future requests between you."
- Decline confirmation: "Declining closes this request. The requester will not receive your contact details."
- Remove connection: "Removing this connection stops discovery and requests between you."

### Trust boundary

- "Card Crew stores card metadata and permissions, never card numbers, CVVs, PINs, OTPs, or bank passwords."

## U4: Canonical Result Labels

| State | Label | Supporting copy | Action |
| --- | --- | --- | --- |
| Direct visible and requestable | `Direct friend` | `Can request` | `Request help` |
| Direct visible, not requestable | `Direct friend` | `Requests unavailable` | Disabled request action |
| Request pending | `Direct friend` | `Request pending` | `View request` |
| Approved request | `Direct friend` | `Contact details available` | `View contact` |
| Declined or ignored | `Direct friend` | `Contact details hidden` | No contact action |
| Hidden/private | No result | `This card is not discoverable` | No action |
| Blocked relationship | No result | `This person is unavailable` | No action |
| No matching owner | No result | `No match in your trusted network` | `Invite a friend` |

Use `Can request` only when the server returns `requestable: true`. The client must not infer requestability from visibility alone.

## Frontend Handoff Checklist

- [x] Home opens on card search.
- [x] Search results distinguish relationship, discovery, and requestability.
- [x] My Cards exposes visibility and request controls without credential fields.
- [x] Requests has incoming/outgoing views and approve/decline/ignore actions.
- [x] Contact action is absent or disabled until the server reports approval.
- [x] Private and blocked resources have no discoverable result card.
- [ ] All empty, loading, error, and success states use the same labels above (see U5 audit — close, not
      verbatim everywhere).

## U5 — Implementation Audit

Reviewed `frontend/src/pages/*` and `frontend/src/components/*` against this document.

### Clarity

- Badges, empty states, and the request lifecycle match the canonical labels in U4 essentially verbatim
  ("Direct friend", "Can request" / "Requests unavailable", "No match in your trusted network").
- **Gap:** the trust/privacy copy in U3 (visibility, request permission, contact handoff, block/decline
  strings) is not yet wired verbatim into the UI. `MyNetworkPage`'s block confirmation and `RequestsPage`'s
  declined/ignored messages are close in meaning but use shorter, ad hoc phrasing rather than the exact U3
  strings. Tracked as an open item in `docs/FRONTEND_PLAN.md` F1.
- `LoginPage` copy ("Find help from people you trust.") matches U2's intent but hasn't been checked against
  a dedicated onboarding copy pass beyond that single line.

### Accessibility basics

- Every form input in `MyCardsPage`, `MyNetworkPage`, and `LoginPage` uses a wrapping `<label>`, giving
  native input association without extra ARIA.
- `RequestComposeModal` has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at its title,
  initial focus on the message field, and closes on Escape. **Still open:** no full tab-focus trap (a user
  can Tab out to the page behind the modal) — acceptable for MVP given the modal is small and short-lived,
  but worth revisiting if modals become a recurring pattern.
- No color-only signal: badges pair color with text ("Can request" / "Requests unavailable"), not color
  alone.

### Scope creep check

- `NetworkGraph` (F7) was built without a dedicated wireframe in this document — U1 only wireframed Home,
  My Cards, My Network, Search Results, and Requests. The implementation stayed lightweight (self + direct
  friends, no physics/visualization dependency) per the PRD's "basic graph UI" guidance, so this is judged
  in-scope, but the wireframe should be back-filled here if the graph view grows further.
- No other screens or flows were found beyond what U1-U4 and `docs/BUILD_PLAN.md` F1-F8 specify — no
  marketplace, payments, or 2nd-degree graph UI crept in.

### Verdict

Approved for MVP sign-off with two tracked follow-ups (U3 copy pass, modal accessibility), neither of
which blocks the PRD's MVP acceptance criteria (see `docs/MVP_RELEASE_CHECKLIST.md`).
