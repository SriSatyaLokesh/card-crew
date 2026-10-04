# Title: feat(icons): Zero-emoji purge and system-wide accessible SVG iconography

**Labels**: `frontend`, `ux`, `accessibility`, `design-system`, `p1-high`  
**Milestone**: Milestone 1 - Design System, Iconography & Brand Identity  

---

## 1. User Story
**As a** Card Crew user accessing the application across various devices (macOS, iOS, Windows, Android, Linux),  
**I want** all user interface actions, card indicators, navigation items, and status indicators to use consistent, crisp, vector-based SVG icons instead of native Unicode emojis,  
**So that** the platform looks professional, trustworthy, renders uniformly across all operating systems, and does not feel like a toy prototype or amateur hobby project.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 4: Consistency & Standards, Heuristic 8: Aesthetic and Minimalist Design):
1. **Severe Inconsistency Across Operating Systems**:
   - The current codebase uses raw unicode emojis across 28+ files (e.g., 💳, 🔒, 👥, 🔔, ⚡, 🔍, 🎁, 🛫, 🏷️, 💬, ⚠️, ❌, ✅).
   - Emojis render completely differently on Windows Segoe UI Emoji (flat, dated 2D contours) vs Apple iOS/macOS Apple Color Emoji (glossy 3D skeuomorphism) vs Android Noto Color Emoji (blob-like).
   - In a fintech / peer-to-peer card sharing application dealing with credit lines and financial trust, colorful cartoon emojis destroy user confidence and trigger scam/phishing suspicion.
2. **Accessibility (a11y) Catastrophe**:
   - Raw emojis lack accessible names. Screen readers (NVDA, JAWS, VoiceOver) announce raw emojis with verbose, unpredictable text strings (e.g., "Card index divider", "Airplane departure", "Bell with slash"), completely disorienting visually impaired users.
   - Screen reader users cannot navigate forms or tables reliably when buttons are solely icon/emoji-based without `aria-label` or `aria-hidden="true"`.
3. **Typography & Layout Shifts**:
   - Unicode emoji glyphs have erratic line-heights, bounding boxes, and vertical alignments across OS font stacks, causing unpredictable layout jitter, baseline misalignment, and truncated button labels.
4. **Current Incomplete State**:
   - `frontend/src/components/icons/BankIcons.tsx` only contains a handful of bank logos.
   - `lucide-react` is already installed in `frontend/package.json` (`^0.344.0`+), yet raw emojis remain hardcoded in `App.tsx`, `Sidebar.tsx`, `DashboardPage.tsx`, `MyCardsPage.tsx`, `RequestsPage.tsx`, `FriendsPage.tsx`, `ChatPage.tsx`, and `ProfilePage.tsx`.

---

## 3. Technical Specifications

### 3.1 Iconography Architecture
All icons must be standardized around:
1. **Lucide React (`lucide-react`)**: General UI controls, navigation, quick actions, status badges, arrows, search, filters.
2. **Domain-Specific Vector SVGs (`frontend/src/components/icons/`)**:
   - Payment networks: Visa, Mastercard, American Express, RuPay, Diners Club.
   - Indian & Global Banks: HDFC, ICICI, SBI, Axis, Kotak, Amex, Standard Chartered.
   - Card hardware emblems: Contactless indicator (`wifi` rotated 90°), EMV Smart Chip SVG.
3. **Accessibility Standard**:
   - All purely decorative icons MUST have `aria-hidden="true"`.
   - All interactive icon-only buttons MUST have a dedicated `aria-label="<Action Name>"` and `title="<Action Name>"`.

### 3.2 Canonical Emoji-to-SVG Mapping Table

| Current Emoji | Replaced With Component | Source | Sizing / Classes |
| :--- | :--- | :--- | :--- |
| 💳 (Card) | `<CreditCard />` | `lucide-react` | `w-5 h-5 text-brand-500` |
| 👥 (Friends / Crew) | `<Users />` | `lucide-react` | `w-5 h-5 text-brand-500` |
| 🔄 (Requests) | `<ArrowLeftRight />` | `lucide-react` | `w-5 h-5 text-amber-500` |
| 💬 (Chat) | `<MessageSquare />` | `lucide-react` | `w-5 h-5 text-indigo-500` |
| 🎁 (Offers) | `<Tag />` | `lucide-react` | `w-5 h-5 text-emerald-500` |
| 🔒 (Vault / Security) | `<ShieldCheck />` | `lucide-react` | `w-5 h-5 text-emerald-600` |
| ⚙️ (Settings) | `<Settings />` | `lucide-react` | `w-5 h-5 text-slate-500` |
| 🔔 (Notifications) | `<Bell />` | `lucide-react` | `w-5 h-5 text-slate-500` |
| ⚡ (Quick Action) | `<Zap />` | `lucide-react` | `w-4 h-4 text-amber-400` |
| 🔍 (Search) | `<Search />` | `lucide-react` | `w-4 h-4 text-slate-400` |
| 🛫 (Lounge Access) | `<Plane />` | `lucide-react` | `w-4 h-4 text-sky-500` |
| 🎟️ (Vouchers) | `<Ticket />` | `lucide-react` | `w-4 h-4 text-purple-500` |
| 🏷️ (Coupons) | `<BadgePercent />` | `lucide-react` | `w-4 h-4 text-pink-500` |
| ⚠️ (Warning) | `<AlertTriangle />` | `lucide-react` | `w-4 h-4 text-amber-500` |
| ❌ (Error / Close) | `<XCircle />` or `<X />` | `lucide-react` | `w-4 h-4 text-rose-500` |
| ✅ (Success / Verified) | `<CheckCircle2 />` | `lucide-react` | `w-4 h-4 text-emerald-500` |
| 🕒 (Pending) | `<Clock />` | `lucide-react` | `w-4 h-4 text-amber-500` |
| ℹ️ (Info) | `<Info />` | `lucide-react` | `w-4 h-4 text-sky-500` |
| 📱 (WhatsApp) | `<MessageCircle />` / `WhatsAppIcon` | `lucide-react` / Custom SVG | `w-4 h-4 text-emerald-600` |

### 3.3 Custom Vector Assets to Create
Create `frontend/src/components/icons/NetworkIcons.tsx`:
```tsx
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export const VisaIcon: React.FC<IconProps> = ({ className = "h-6 w-auto", ...props }) => (
  <svg viewBox="0 0 48 16" fill="currentColor" className={className} aria-label="Visa" {...props}>
    {/* Clean vector path for Visa wordmark */}
  </svg>
);

export const MastercardIcon: React.FC<IconProps> = ({ className = "h-6 w-auto", ...props }) => (
  <svg viewBox="0 0 36 24" fill="none" className={className} aria-label="Mastercard" {...props}>
    <circle cx="12" cy="12" r="12" fill="#EB001B"/>
    <circle cx="24" cy="12" r="12" fill="#F79E1B" fillOpacity="0.8"/>
  </svg>
);

export const RuPayIcon: React.FC<IconProps> = ({ className = "h-6 w-auto", ...props }) => (
  <svg viewBox="0 0 80 20" fill="currentColor" className={className} aria-label="RuPay" {...props}>
    {/* RuPay vector contours */}
  </svg>
);

export const AmexIcon: React.FC<IconProps> = ({ className = "h-6 w-auto", ...props }) => (
  <svg viewBox="0 0 48 30" fill="currentColor" className={className} aria-label="American Express" {...props}>
    {/* Amex box logo */}
  </svg>
);

export const ChipIcon: React.FC<IconProps> = ({ className = "w-9 h-7", ...props }) => (
  <svg viewBox="0 0 44 32" fill="none" className={className} aria-hidden="true" {...props}>
    <rect width="44" height="32" rx="5" fill="#D4AF37" stroke="#997A15" strokeWidth="1.5"/>
    <path d="M0 11H14M0 21H14M30 11H44M30 21H44M14 0V32M30 0V32" stroke="#997A15" strokeWidth="1.2"/>
    <rect x="14" y="8" width="16" height="16" rx="3" fill="#E6C65B" stroke="#997A15" strokeWidth="1"/>
  </svg>
);

export const ContactlessIcon: React.FC<IconProps> = ({ className = "w-5 h-5", ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className} aria-hidden="true" {...props}>
    <path d="M8.5 16.5a5 5 0 0 1 0-9"/>
    <path d="M12 19a8.5 8.5 0 0 1 0-14"/>
    <path d="M15.5 21.5a12 12 0 0 1 0-19"/>
  </svg>
);
```

---

## 4. Step-by-Step Implementation Guide
1. **Audit & Purge**:
   - Run a repository-wide regex search for Unicode emoji blocks: `[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]`.
   - Record every file and replace emoji strings with corresponding `lucide-react` or `frontend/src/components/icons/*` components.
2. **Implement Network and Hardware Icons**:
   - Create `frontend/src/components/icons/NetworkIcons.tsx` exporting `VisaIcon`, `MastercardIcon`, `RuPayIcon`, `AmexIcon`, `DinersIcon`, `ChipIcon`, `ContactlessIcon`.
3. **Expand Bank Icons**:
   - Enhance `frontend/src/components/icons/BankIcons.tsx` to export verified SVG vectors for HDFC Bank, ICICI Bank, SBI, Axis Bank, Kotak Mahindra Bank, American Express, Standard Chartered, IndusInd Bank, and RBL Bank.
4. **Update Core UI Navigation & Pages**:
   - In `frontend/src/components/Sidebar.tsx`: Replace navigation emojis with `LayoutDashboard`, `CreditCard`, `Users`, `ArrowLeftRight`, `Tag`, `ShieldCheck`, `Settings`.
   - In `frontend/src/pages/DashboardPage.tsx`: Replace stat emojis with Lucide icons with colored background circles.
   - In `frontend/src/pages/RequestsPage.tsx`: Replace status emojis (`✅`, `❌`, `🕒`) with `<CheckCircle2 />`, `<XCircle />`, `<Clock />`.
   - In `frontend/src/pages/ChatPage.tsx`: Replace chat action emojis with `<Send />`, `<Paperclip />`, `<Shield />`.
5. **Lint Rule Enforcement**:
   - Add an ESLint rule or pre-commit hook regex check that fails the build if literal emoji characters are introduced in `.tsx` files outside of mock strings or test fixtures.

---

## 5. Security, Privacy & Integrity Boundaries
- **No External CDN Dependencies**: All SVGs must be embedded as inline React components or loaded from local assets. Never fetch icon SVGs from untrusted third-party CDNs at runtime (prevents SVG XSS and supply-chain tampering).
- **Sanitized SVG Markup**: Custom SVGs must not contain inline `<script>` tags, `onload`, or `onerror` handlers.

---

## 6. Acceptance Criteria Checklist
- [ ] Zero unicode emojis remain in the application UI (verified by regex search on `frontend/src/**/*.tsx`).
- [ ] All navigation items in desktop sidebar and mobile bottom navigation use `lucide-react` icons.
- [ ] Network icons (Visa, Mastercard, RuPay, Amex) render as crisp inline SVGs on all cards.
- [ ] EMV smart chip and contactless indicators render as crisp SVGs.
- [ ] Bank logos render as verified SVGs with fallback to bank initials if unmapped.
- [ ] All icon-only buttons include `aria-label` and `title` attributes.
- [ ] All decorative icons carry `aria-hidden="true"`.
- [ ] Application builds without lint errors (`npm run build`).

---

## 7. Verification & Test Plan
1. **Automated Scanner**:
   - Run grep command in pwsh:
     ```powershell
     Get-ChildItem -Path frontend/src -Recurse -Include *.tsx,*.ts | Select-String -Pattern "[\uD83C-\uDBFF\uDC00-\uDFFF]"
     ```
   - Must output 0 matching lines in production UI code.
2. **Visual Inspection**:
   - Inspect cards, dashboard, navigation, modals on Chrome, Firefox, Safari, and mobile viewport (390px).
   - Ensure icons scale cleanly with zero blurriness or layout displacement.
