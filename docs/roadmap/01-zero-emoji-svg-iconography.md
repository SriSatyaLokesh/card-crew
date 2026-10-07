# Milestone 1: Zero-Emoji Audit & Accessible SVG Iconography System

**Tracked Issue:** [#41](https://github.com/SriSatyaLokesh/card-crew/issues/41)  
**Priority:** High (Visual Hygiene & Foundation)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Low / Medium  

---

## 1. Executive Summary & User Story

> **As a user and developer of Card Crew**, I want all user interface elements to use clean, crisp, accessible SVG icons instead of raw unicode emojis, so that the application maintains a serious, polished, professional, and cross-platform consistent aesthetic.

Unicode emojis degrade visual seriousness, vary unpredictably across platforms (macOS, Windows, iOS, Android, Linux), lack vector scalability, and cannot be colored dynamically using CSS variables or `currentColor`. This milestone purges every unicode emoji from the application and installs an accessible, high-performance SVG iconography system aligned with the Card Crew design system (`docs/design.md`).

---

## 2. Codebase Audit: Current Emoji Locations

An audit of `frontend/src/` reveals unicode emojis actively rendered in the following files:

| File | Component / Area | Emojis Found | Replacement Target |
|---|---|---|---|
| `frontend/src/components/NavBar.tsx` | Main navigation tabs | `🔍` (Search), `💳` (My Cards), `👥` (Network), `📬` (Requests), `💬` (Messages), `⚙️` (Profile) | `SearchIcon`, `CreditCardIcon`, `UsersIcon`, `InboxIcon`, `MessageSquareIcon`, `SettingsIcon` |
| `frontend/src/components/NetworkStatsDashboard.tsx` | Dashboard metric pills | `📬` (Total Requests), `👥` (Direct Friends), `🌱` (FoF), `📥` (Incoming), `📤` (Pending) | `MailboxIcon`, `UsersIcon`, `NetworkIcon` / `SproutIcon`, `ArrowDownLeftIcon`, `ArrowUpRightIcon` |
| `frontend/src/components/CardTile.tsx` | Visibility scope pills & indicators | `🌐` (Network scope), `👥` (Direct scope), text `)))` (Contactless) | `GlobeIcon`, `UsersIcon`, `ContactlessWaveIcon` |
| `frontend/src/components/SavedCardItem.tsx` | Card visual container | `🌐` (Network), `👥` (Direct), text `)))` | `GlobeIcon`, `UsersIcon`, `ContactlessWaveIcon` |
| `frontend/src/components/PersonCardsModal.tsx` | Modal header, card lists, close | `💳`, `👥`, `🌐`, `✕` | `CreditCardIcon`, `UsersIcon`, `GlobeIcon`, `CloseIcon` |
| `frontend/src/components/CardModal.tsx` | Form feedback & alerts | `⚠️` (Error callout), `✕` (Close button) | `AlertCircleIcon`, `XIcon` |
| `frontend/src/components/MessageButton.tsx` | Chat launcher buttons | `💬`, `✉️` | `MessageSquareIcon` |
| `frontend/src/components/RelationshipBadge.tsx` | Trust indicators | `👤`, `👥`, `🌐` | `UserIcon`, `UsersIcon`, `GlobeIcon` |
| `frontend/src/pages/HomePage.tsx` | Greeting & notification toasts | `👋` (Greeting wave), `⚠️` (Error), `✓` (Success) | Clean typography greeting (no wave), `AlertTriangleIcon`, `CheckCircleIcon` |
| `frontend/src/pages/MyCardsPage.tsx` | Page status toasts | `⚠️` (Error), `✓` (Success) | `AlertTriangleIcon`, `CheckCircleIcon` |
| `frontend/src/pages/MyNetworkPage.tsx` | Tab headers & statuses | `👥`, `📥`, `📤`, `🚫` | `UsersIcon`, `InboxIcon`, `SendIcon`, `ShieldAlertIcon` |
| `frontend/src/pages/RequestsPage.tsx` | Tab pills & statuses | `📥`, `📤`, `⏳`, `✓`, `✕` | `InboxIcon`, `SendIcon`, `ClockIcon`, `CheckIcon`, `XIcon` |

---

## 3. Technical Architecture & Specifications

### 3.1 Icon Library vs Component Registry Decision

To maintain high performance, full offline support, and zero external network latency:
- **Primary Recommendation:** Install `lucide-react` (`^0.400.0` or latest) in `frontend/package.json`.
  - Highly optimized, tree-shakeable SVG icons.
  - Consistent 24x24 `viewBox`, 2px stroke, clean geometric curves matching our `Quicksand` / `Caveat` typography.
- **Custom Hardware / Domain SVGs:** For domain-specific card symbols that general libraries lack, create dedicated components in `frontend/src/components/icons/`:
  - `EmvChipIcon.tsx`: Precision SVG representation of a credit/debit smart chip.
  - `ContactlessWaveIcon.tsx`: Proper 4-arc EMV contactless wave SVG.
  - `VisaLogo.tsx`, `MasterCardLogo.tsx`, `AmexLogo.tsx`, `RuPayLogo.tsx`, `DinersClubLogo.tsx`.

### 3.2 Icon Styling & Accessibility Rules

Every SVG icon must satisfy:
1. `aria-hidden="true"` when accompanied by descriptive visible text or within an already-labeled interactive element.
2. An explicit `aria-label` or `<title>` child element when acting as a standalone icon-only button (e.g., modal close buttons or password toggles).
3. Sizing controlled via CSS variables or standard props:
   - `size-xs`: 14px (inline metadata pills)
   - `size-sm`: 16px (buttons and form fields)
   - `size-md`: 20px (navigation and dashboard pills)
   - `size-lg`: 24px (hero sections and empty states)
4. Dynamic color inheritance using `fill="none" stroke="currentColor"` or theme tokens (`var(--cobalt-600)`, `var(--leaf-700)`, `var(--amber-800)`, `var(--red-700)`).

---

## 4. Implementation Steps

1. **Dependency Setup:**
   ```bash
   cd frontend
   npm install lucide-react
   ```
2. **Custom Vector Assets:**
   - Create `frontend/src/components/icons/EmvChipIcon.tsx`
   - Create `frontend/src/components/icons/ContactlessWaveIcon.tsx`
3. **Component Refactoring:**
   - Refactor `NavBar.tsx`: replace unicode characters with Lucide icons.
   - Refactor `NetworkStatsDashboard.tsx`: replace emojis with Lucide icons.
   - Refactor `CardTile.tsx` and `SavedCardItem.tsx`: use `Globe`, `Users`, and `ContactlessWaveIcon`.
   - Refactor `CardModal.tsx` and `PersonCardsModal.tsx`: replace `⚠️` and `✕` with `AlertCircle` and `X`.
   - Refactor `HomePage.tsx`, `MyCardsPage.tsx`, `RequestsPage.tsx`, and `MyNetworkPage.tsx`: eliminate all emoji toasts and greeting waves.
4. **Automated Guardrail:**
   - Add a test in `tests/integration/icons.test.ts` (or custom script) that scans `frontend/src/**/*.{tsx,ts,html}` with the regex `/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]/` and fails if any emoji character is detected.

---

## 5. Acceptance Criteria

- [ ] Zero unicode emojis exist in `frontend/src/` (verified via script/test).
- [ ] All navigation, status, modal, and action buttons render responsive SVG icons.
- [ ] Screen readers announce accessible names for all icon buttons without double-voicing.
- [ ] Color contrast for all icon strokes meets WCAG 2.1 AA (minimum 3:1 for graphical UI elements, 4.5:1 for accompanying text).
