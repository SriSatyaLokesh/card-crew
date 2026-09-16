# Card Crew UI Design System

Status: implementation source of truth
Product: Trusted Personal Resource Network, India-first
Scope: MVP web app, mobile-first and responsive

## Product Feeling

Card Crew should feel like a trusted personal index: calm, legible, human, and slightly editorial. It is not a bank portal, a marketplace, or a social feed. The interface should make one action obvious: search for a resource through people the user trusts.

The visual language is **paper index + signal blue**:

- Warm off-white surfaces create a private notebook feeling.
- Ink-black typography keeps financial/privacy content serious.
- Cobalt blue is the primary action and navigation signal.
- Leaf green means a permission is available, never general decoration.
- Amber is reserved for pending decisions and review states.
- Red is reserved for destructive or denied states.

## Design Principles

1. Search first. The home screen begins with the card/resource search, not a dashboard of metrics.
2. Trust is explicit. Always separate `Direct friend`, `Can request`, and `Contact available`.
3. Privacy is visible. Use plain language for discoverability, requestability, and contact handoff.
4. Metadata only. Never visually suggest that Card Crew stores payment credentials.
5. One primary action per screen. Secondary management actions stay quieter.
6. Dense enough for repeat use, spacious enough for mobile touch.
7. No public trust score. Relationship labels are contextual, not rankings of people.

## Tokens

### Color

```css
:root {
  --ink-950: #171717;
  --ink-800: #292524;
  --ink-600: #57534e;
  --ink-400: #a8a29e;
  --paper-50: #faf9f6;
  --paper-100: #f1efe9;
  --paper-200: #e3dfd5;
  --white: #ffffff;
  --cobalt-700: #1d4ed8;
  --cobalt-600: #2563eb;
  --cobalt-100: #dbeafe;
  --leaf-700: #166534;
  --leaf-100: #dcfce7;
  --amber-800: #92400e;
  --amber-100: #fef3c7;
  --red-700: #b91c1c;
  --red-100: #fee2e2;
  --focus: #0f766e;
}
```

Contrast requirements:

- Body text uses `--ink-950` or `--ink-800` on paper/white surfaces.
- Secondary text must remain at least 4.5:1; do not use `--ink-400` for readable copy.
- Status colors always include text, never color alone.
- Focus rings use `--focus` with a 3px outer ring.

### Typography

Primary recommendation from UI/UX Pro Max was a friendly handwritten pairing. For this privacy-sensitive utility, use the same warmth more carefully:

- Display/brand: `Caveat`, 600-700, only for the Card Crew wordmark or short welcome phrase.
- UI/body: `Quicksand`, 400-700, for readable rounded utility text.
- Numeric/card metadata: `ui-monospace`, `SFMono-Regular`, `Consolas`, monospace figures where alignment matters.

```css
:root {
  --font-display: "Caveat", cursive;
  --font-body: "Quicksand", "Segoe UI", sans-serif;
  --font-data: ui-monospace, SFMono-Regular, Consolas, monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.25rem;
}
```

Body text is never smaller than 16px on mobile. Line height is 1.5 or higher for explanatory/privacy copy.

### Spacing and shape

Use a 4/8 rhythm:

- `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`.
- Default control height: 48px on mobile.
- Minimum touch target: 44px; preferred: 48px.
- Card radius: 10px.
- Modal radius: 14px.
- Avoid pill-shaped containers except compact status badges.
- Borders are `1px solid var(--paper-200)`; shadows are soft and rare.

## Layout

### Desktop >= 1024px

- Left rail: 232px, persistent brand and primary destinations.
- Main content: max 920px, left aligned.
- Optional right context rail: 280px for network summary or request status.
- Search hero occupies the first viewport, with the next result section visible below it.

### Tablet 768-1023px

- Compact top bar with brand and menu.
- Main content max 720px.
- Network graph remains a simple row/list, never a dense canvas.

### Mobile 0-767px

- Top bar with wordmark and profile menu.
- Bottom navigation with no more than four destinations: Search, My Cards, Network, Requests.
- `padding-bottom` reserves space for the fixed navigation.
- Main content uses 16px gutters.
- Cards stack vertically; controls wrap without horizontal scrolling.
- Search field is full width and first interactive element after the heading.

## Screen Direction

### Home / Search

- H1: `Find help from people you trust`.
- Search field is the primary visual anchor, with a magnifier icon and a visible label.
- Suggested cards appear as compact rows with issuer, card name, network, and UPI marker where relevant.
- Results are person/resource rows, not giant cards.
- Direct friend is blue; Can request is green; Requests unavailable is neutral; Contact available is green with a lock/unlock explanation.
- Empty state always includes the next action: Invite a friend or Add a card.

### My Cards

- Use a filter strip: All, UPI, Credit, Debit, Travel, Cashback, Fuel, Lifestyle.
- Catalog rows show issuer, product, network, variant, and use-case tags.
- Add flow progressively discloses visibility and request controls after card selection.
- Notes helper text must state: `Never enter a card number, CVV, PIN, or OTP here.`
- Existing resources use inline controls for visibility and requests; destructive removal is confirmed.

### My Network

- Group by Direct friends, Incoming requests, Outgoing requests, Blocked.
- Show names, not raw UUIDs.
- Invite is a single clear action; current MVP uses user ID until lookup-by-email exists.
- Block/remove confirmations explain the privacy consequence.

### Requests

- Incoming and Outgoing are tabs with pending counts when available.
- Request rows show requester/owner, card name, relationship, message, and state.
- Approve is the primary action; Decline and Ignore are secondary.
- Contact details are never present in DOM before approval. After approval, show the permitted contact fields with a clear explanation.

### Network Context

- Use a lightweight node list, not a decorative graph visualization.
- Self is visually distinct; direct friends are neutral; matching friends receive a green outline and a `1 match` label.
- Never show unrelated graph edges or a public trust score.

## Components

### Buttons

- Primary: cobalt fill, white text, 48px height.
- Secondary: white/paper fill, ink text, paper border.
- Destructive: red text/border, never the same visual weight as the primary CTA.
- Disabled: reduced emphasis and `cursor: not-allowed`; retain readable contrast.
- Every async button disables during the request and communicates progress (`Sending...`, `Loading...`).

### Badges

Badges are text-first compact labels, not decorative pills:

- `Direct friend` — blue background/text.
- `Can request` — green background/text.
- `Requests unavailable` — neutral background/text.
- `Pending` — amber background/text.
- `Contact available` — green background/text plus explanatory copy.

### Forms

- Visible labels, never placeholder-only.
- `autocomplete` on email/password fields.
- Inputs and selects at least 48px tall.
- Errors appear below the related field or action and use `role="alert"` where appropriate.
- Success messages use `aria-live="polite"` and remain visible long enough to read.

### Modal

- Scrim 45-55% black.
- Title linked with `aria-labelledby`.
- Initial focus moves to the first useful field.
- Escape and Cancel close without submitting.
- Keep modal content short; primary action is visually dominant.
- Add a focus trap before introducing more modal-heavy flows.

## Motion

- 150-250ms ease-out for hover/pressed/focus transitions.
- Use opacity/transform only; avoid layout animation.
- Search result reveal may stagger 30ms per row, capped at five rows.
- Respect `prefers-reduced-motion: reduce` by removing stagger and transform motion.
- No decorative floating shapes, bokeh, or looping background motion.

## Accessibility and QA

- Keyboard order follows visual order.
- Skip link targets `<main>`.
- Route changes move focus to the page heading.
- All nav links have text labels.
- All icon buttons have accessible names.
- Status colors have text equivalents.
- Test at 375px, 768px, 1024px, and 1440px.
- Test with reduced motion and browser text zoom at 200%.
- No horizontal scrolling at any supported width.

## Product Boundaries

Do not add UI for:

- Card numbers, CVV, PIN, OTP, bank credentials, or password sharing.
- Payments, escrow, marketplace settlement, or lending.
- Second-degree graph traversal in MVP.
- AI chat or A2UI before deterministic flows are stable.
- Public trust scores or rankings of friends.
