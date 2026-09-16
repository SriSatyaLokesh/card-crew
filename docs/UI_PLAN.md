# Card Crew UI Implementation Plan

Status: ready for app implementation
Source requirements: `docs/trusted_personal_resource_network_prd.md`
Design source of truth: `docs/design.md`

## Goal

Turn the working MVP into a coherent, mobile-first product experience for the core loop:

`sign up -> add trusted friend -> add card -> search network -> request help -> owner decides -> contact handoff`

The UI must keep discovery, requestability, and contact access visibly separate at every step.

## Phase 0: Foundation

### 0.1 Load the design system

- Import `Caveat` and `Quicksand` with `font-display: swap`.
- Replace raw colors in `frontend/src/App.css` with the semantic tokens in `docs/design.md`.
- Establish `--space-*`, `--radius-*`, `--shadow-*`, and `--motion-*` tokens.
- Add a global `:focus-visible` treatment.
- Add `prefers-reduced-motion` overrides.
- Use `min-height: 100dvh` and preserve browser zoom.

### 0.2 Application shell

Files: `frontend/src/App.tsx`, `frontend/src/components/NavBar.tsx`, `frontend/src/App.css`

- Add a skip link and `main` landmark with a stable focus target.
- Desktop: persistent left rail; mobile: labeled bottom navigation with Search, My Cards, Network, Requests.
- Keep sign-out visually separated from primary navigation.
- Preserve deep links: `/`, `/cards`, `/network`, `/requests`.
- On route change, focus the page heading.

Acceptance:

- Every route is reachable by keyboard and URL.
- Navigation does not change hierarchy between pages.
- Mobile content is not obscured by bottom navigation.

## Phase 1: Home / Search

Files: `frontend/src/pages/HomePage.tsx`, `frontend/src/components/NetworkGraph.tsx`

- Make search the first focused action after auth restoration.
- Add a compact catalog result row with issuer, product, network, variant, category, UPI, and use-case labels.
- Add filter chips/select for UPI, credit, debit, travel, cashback, fuel, and lifestyle.
- Preserve the selected query when navigating back from a request.
- Replace raw `Loading...` paragraphs with stable skeleton rows for catalog and results.
- Add a result count and explicit empty state.
- Keep the graph as context below results, not as the hero interaction.

Acceptance:

- Search works at 375px without horizontal scrolling.
- A requestable result has both `Direct friend` and `Can request` labels plus one clear CTA.
- A private/blocked result is absent, not blurred or teased.

## Phase 2: My Cards

Files: `frontend/src/pages/MyCardsPage.tsx`

- Use a two-stage add flow: choose card, then configure visibility/requestability.
- Show catalog metadata consistently: issuer, product, category, network, variant, UPI, use cases.
- Keep notes optional and visibly protected by the no-credentials helper text.
- Add a filter/search toolbar that wraps on mobile.
- Use a success announcement after add/update/remove.
- Add a reversible removal toast or undo path before V1 if soft-deleted resources remain recoverable.

Acceptance:

- A user can find a specific variant without confusing Visa/RuPay/co-branded records.
- The UI never requests payment credentials.
- Add/edit/remove actions provide loading, success, and recovery feedback.

## Phase 3: My Network

Files: `frontend/src/pages/MyNetworkPage.tsx`

- Replace raw IDs in all visible rows with display names; retain IDs only for copy/debug affordances if needed.
- Use clear sections: Direct friends, Incoming, Outgoing, Blocked.
- Add confirmation copy from the UX wireframes for block/remove.
- Make invitation limitation explicit until backend email/phone lookup exists.
- Add pending count to the Requests/Network navigation only when meaningful.

Acceptance:

- The user can distinguish a pending invite from an accepted friendship without color alone.
- Blocked users cannot be selected for resource requests.
- Destructive actions are confirmable and keyboard accessible.

## Phase 4: Requests and Handoff

Files: `frontend/src/pages/RequestsPage.tsx`, `frontend/src/components/RequestComposeModal.tsx`

- Improve the request row hierarchy: person, card, relationship, message, state, action.
- Keep Incoming and Outgoing as a simple two-tab control.
- Approve is primary; Decline and Ignore are secondary.
- Contact data must be fetched only after approval and never rendered before the server response.
- Add `aria-live="polite"` for sent/approved/contact success messages.
- Add focus trap for the compose modal before adding more modal flows.

Acceptance:

- Pending requests expose no contact information.
- Declined and ignored requests explicitly say contact remains hidden.
- Approved requests show only the fields returned by the server.

## Phase 5: Responsive and Accessibility Pass

Viewport checks:

- 375px portrait: small phone, no overflow.
- 768px portrait: tablet transition.
- 1024px: desktop rail.
- 1440px: maximum reading width and context rail.
- Landscape at phone and tablet widths.

Accessibility checks:

- Keyboard-only navigation.
- Screen reader labels for fields, badges, modal, and async status.
- 200% browser text zoom.
- `prefers-reduced-motion` enabled.
- Focus remains visible on paper and cobalt surfaces.
- Color is never the only signal for status or permission.

## Phase 6: Visual QA

- Verify all surfaces use the semantic design tokens.
- Verify no default browser margins leak into the shell.
- Verify card rows do not resize when metadata or status changes.
- Verify all buttons have at least 44px hit areas and 8px spacing.
- Verify error/success colors meet contrast requirements.
- Verify no emoji or improvised glyph is used as a structural icon.
- Verify the home screen shows the search experience in the first viewport with a hint of results/context below.

## Delivery Order

1. Foundation tokens and shell.
2. Home search and catalog metadata.
3. My Cards filters and add/edit flow.
4. Network grouping and action feedback.
5. Requests/handoff accessibility.
6. Responsive/accessibility QA.
7. Browser screenshots and final visual review.

## Non-goals

- No new backend domain behavior in this UI pass.
- No payment, marketplace, or credential-entry surface.
- No second-degree graph UI.
- No AI chat or agent surface.
- No heavy chart/graph dependency for the MVP.
