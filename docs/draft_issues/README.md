# Card Crew — Production Issue Backlog (Drafts)

> [!NOTE]
> This directory contains 16 standalone, fully specified issue drafts decomposed from the **Card Crew Product Roadmap v2.0** and the **UI/UX Brutal Usability Audit**.
> Every issue contains complete User Stories, Nielsen-Norman Heuristic Audit findings, database migrations, RPC signatures, TypeScript types, UI component architectures, security boundaries, and binary acceptance criteria checklists.

---

## 📋 Master Issue Directory

| Issue ID | File | Domain | Priority | Milestone | Key Deliverable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | [`ISSUE-01-svg-iconography.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-01-svg-iconography.md) | `frontend`, `a11y` | `P1-High` | Milestone 1 | Zero-emoji purge, `lucide-react` + payment network SVG vectors (`NetworkIcons.tsx`, `BankIcons.tsx`). |
| **02** | [`ISSUE-02-modern-design-system-branding.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-02-modern-design-system-branding.md) | `design-system`, `branding` | `P1-High` | Milestone 1 | Modern Trust tokens, Plus Jakarta Sans, Card Crew vector shield logo, SVG favicon. |
| **03** | [`ISSUE-03-database-card-colors.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-03-database-card-colors.md) | `database`, `backend` | `P1-High` | Milestone 2 | `catalog_cards` visual metadata (`card_color`, `accent_color`, `gradient_theme`, `card_level`). |
| **04** | [`ISSUE-04-realistic-visual-card-engine.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-04-realistic-visual-card-engine.md) | `frontend`, `ui` | `P1-High` | Milestone 2 | ISO/IEC 7810 ID-1 ($1.586:1$) `VisualCard.tsx` with EMV chip, contactless waves, and contrast mode. |
| **05** | [`ISSUE-05-database-first-add-card-bugfix.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-05-database-first-add-card-bugfix.md) | `bug`, `data-integrity` | `P0-Critical` | Milestone 3 | Remove silent random fallback bug in `apiClient.ts`; implement custom card submission flow. |
| **06** | [`ISSUE-06-auth-redesign-multi-identifier.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-06-auth-redesign-multi-identifier.md) | `auth`, `frontend` | `P1-High` | Milestone 4 | Redesigned auth supporting Email, Indian Phone (+91), and unique @username handles. |
| **07** | [`ISSUE-07-friend-lookup-phone-email-username.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-07-friend-lookup-phone-email-username.md) | `social`, `privacy` | `P1-High` | Milestone 4 | Privacy-safe, anti-harvesting friend search RPC matching by exact phone, @handle, or email. |
| **08** | [`ISSUE-08-mobile-first-bottom-nav-sheet-modals.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-08-mobile-first-bottom-nav-sheet-modals.md) | `mobile`, `ux` | `P1-High` | Milestone 5 | `BottomNavBar.tsx` (5 thumb-zone tabs), `SheetModal.tsx` (slide-up drawers), 48px touch targets. |
| **09** | [`ISSUE-09-dashboard-reconstruction-search-first.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-09-dashboard-reconstruction-search-first.md) | `dashboard`, `ux` | `P1-High` | Milestone 6 | Search-first dashboard, Crew Card Matcher ("Best card for Swiggy"), 1-click Quick Action strip. |
| **10** | [`ISSUE-10-requests-page-zero-scroll.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-10-requests-page-zero-scroll.md) | `ui`, `mobile` | `P1-High` | Milestone 7 | Eliminate wide 1,125-line table; responsive card stack, zero horizontal scroll, 1-click WhatsApp hand-off. |
| **11** | [`ISSUE-11-chat-trust-gate-security-fix.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-11-chat-trust-gate-security-fix.md) | `security`, `backend` | `P0-Critical` | Milestone 8 | Fix chat authorization gate in `get_or_create_direct_chat`; enforce friendship or active request. |
| **12** | [`ISSUE-12-svg-customizable-avatars.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-12-svg-customizable-avatars.md) | `ui`, `performance` | `P2-Medium` | Milestone 8 | Seed-based vector SVG avatars (`SvgAvatar.tsx`); eliminate heavy binary image uploads. |
| **13** | [`ISSUE-13-chat-safety-disclaimer-content-guard.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-13-chat-safety-disclaimer-content-guard.md) | `security`, `compliance` | `P1-High` | Milestone 8 | Persistent chat safety disclaimer and Luhn/CVV regex guard intercepting sensitive card secrets. |
| **14** | [`ISSUE-14-device-local-encrypted-vault.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-14-device-local-encrypted-vault.md) | `cryptography`, `privacy`| `P2-Medium` | Milestone 9 | Zero-knowledge device-local encrypted vault (Web Crypto AES-GCM 256-bit + IndexedDB) with auto-lock. |
| **15** | [`ISSUE-15-generic-resource-policy-and-v1-types.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-15-generic-resource-policy-and-v1-types.md) | `backend`, `database` | `P2-Medium` | Milestone 10 | Generic resource policy model for coupons, shopping vouchers, and airport lounge passes. |
| **16** | [`ISSUE-16-merchant-offers-engine.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/draft_issues/ISSUE-16-merchant-offers-engine.md) | `offers`, `social` | `P2-Medium` | Milestone 11 | Curated merchant offers engine with 1-click Offer $\rightarrow$ Card $\rightarrow$ Friend request flow. |

---

## 🚀 GitHub Issue Creation Automation Script

When approved by the user, run the following PowerShell command in the workspace root to batch-create these issues directly on GitHub:

```powershell
$issues = @(
  @{ File = "docs/draft_issues/ISSUE-01-svg-iconography.md"; Title = "feat(icons): Zero-emoji purge and system-wide accessible SVG iconography"; Labels = "frontend,ux,accessibility,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-02-modern-design-system-branding.md"; Title = "feat(design-system): Modern Trust design system, Card Crew vector logo, and SVG favicon"; Labels = "frontend,ui,design-system,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-03-database-card-colors.md"; Title = "feat(database): Database-backed card branding colors and gradient themes in catalog_cards"; Labels = "backend,database,supabase,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-04-realistic-visual-card-engine.md"; Title = "feat(ui): Photorealistic credit card visual engine (VisualCard.tsx) with authentic hardware emblems"; Labels = "frontend,ui,components,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-05-database-first-add-card-bugfix.md"; Title = "fix(cards): Eliminate random card assignment fallback bug and implement database-first Add Card flow"; Labels = "bug,frontend,backend,data-integrity,p0-critical" },
  @{ File = "docs/draft_issues/ISSUE-06-auth-redesign-multi-identifier.md"; Title = "feat(auth): Redesign authentication flow with multi-identifier support (Email, Phone, Username)"; Labels = "frontend,backend,auth,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-07-friend-lookup-phone-email-username.md"; Title = "feat(friends): Multi-identifier friend discovery (Phone, Username, Email) with privacy-safe exact matching"; Labels = "frontend,backend,social,privacy,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-08-mobile-first-bottom-nav-sheet-modals.md"; Title = "feat(mobile): Mobile-first ergonomic overhaul with BottomNavBar, SheetModal, and 48px touch targets"; Labels = "frontend,mobile,ui,ux,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-09-dashboard-reconstruction-search-first.md"; Title = "feat(dashboard): Search-first dashboard reconstruction with 1-click Quick Action bar and Crew Card Matcher"; Labels = "frontend,ui,ux,dashboard,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-10-requests-page-zero-scroll.md"; Title = "feat(requests): Complete Requests page overhaul with responsive card stack, zero horizontal scrolling, and 1-click WhatsApp hand-off"; Labels = "frontend,ui,ux,mobile,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-11-chat-trust-gate-security-fix.md"; Title = "fix(security): Chat trust-graph authorization gate and storage RLS policy hardening"; Labels = "security,backend,database,p0-critical" },
  @{ File = "docs/draft_issues/ISSUE-12-svg-customizable-avatars.md"; Title = "feat(profile): Customizable seed-based SVG avatars to eliminate binary photo storage bloat"; Labels = "frontend,ui,profile,p2-medium" },
  @{ File = "docs/draft_issues/ISSUE-13-chat-safety-disclaimer-content-guard.md"; Title = "feat(chat): Chat safety disclaimer banner and client/server card-secret content guard"; Labels = "security,frontend,backend,p1-high" },
  @{ File = "docs/draft_issues/ISSUE-14-device-local-encrypted-vault.md"; Title = "feat(vault): Device-local zero-knowledge encrypted card vault (Web Crypto AES-GCM + IndexedDB)"; Labels = "security,frontend,cryptography,p2-medium" },
  @{ File = "docs/draft_issues/ISSUE-15-generic-resource-policy-and-v1-types.md"; Title = "feat(resources): Generic resource sharing policy engine and V1 perk types (Coupons, Vouchers, Lounge Passes)"; Labels = "backend,database,frontend,p2-medium" },
  @{ File = "docs/draft_issues/ISSUE-16-merchant-offers-engine.md"; Title = "feat(offers): Merchant offers engine with Offer -> Card -> Friend network matcher"; Labels = "frontend,backend,database,offers,p2-medium" }
)

foreach ($issue in $issues) {
  Write-Host "Creating issue: $($issue.Title)..."
  gh issue create --title "$($issue.Title)" --body-file "$($issue.File)" --label "$($issue.Labels)"
}
```
