# Title: feat(ui): Photorealistic credit card visual engine (VisualCard.tsx) with authentic hardware emblems

**Labels**: `frontend`, `ui`, `components`, `design-system`, `p1-high`  
**Milestone**: Milestone 2 - Realistic Card Visual Engine & Database Expansion  

---

## 1. User Story
**As a** Card Crew user managing cards or selecting a friend's card for a transaction,  
**I want** cards to render on-screen with the realistic proportion, texture, bank emblem, EMV chip, contactless waves, and network branding of a genuine physical payment card,  
**So that** card selection is instantaneous, visually satisfying, immediately recognizable, and inspires trust.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic Heuristic 2: Match between system and real world, Heuristic 8: Aesthetic and Minimalist Design):
1. **Unrealistic & Clunky Dimensions**:
   - Currently, cards render as generic rectangular div containers with arbitrary heights, random padding, and mismatched borders across `MyCardsPage.tsx`, `DashboardPage.tsx`, and `RequestsPage.tsx`.
   - Cards lack the universal standard ISO/IEC 7810 ID-1 aspect ratio ($85.60 \times 53.98 \text{ mm} \approx 1.586:1$).
2. **Missing Essential Card Hardware Emblems**:
   - Real payment cards universally feature an EMV contact chip, contactless antenna waves, bank insignia, and payment network logos.
   - The current UI omits these entirely, rendering plain text like "Visa" or "HDFC" inside raw paragraphs, making the app look like an unstyled school project.
3. **No Cohesive Component Architecture**:
   - There are at least 3 conflicting implementations of card displays in the codebase with duplicated logic, inconsistent font sizes, and broken hover animations.

---

## 3. Technical Specifications

### 3.1 ISO ID-1 Standard Geometry & Layout
- **Aspect Ratio**: `aspect-[1.586/1]` (width to height).
- **Corner Radius**: `rounded-2xl` (~16px border-radius) matching standard 3.18mm card corner beveling.
- **Layers**:
  1. Base Layer: CSS `gradient_theme` or solid `card_color`.
  2. Specular Sheen Layer: Diagonal subtle translucent gradient (`bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none`).
  3. Header Row: Bank Name / SVG Logo (top-left) + Contactless SVG & Card Level Badge (top-right).
  4. Hardware Mid-Row: Gold/Bronze EMV Chip SVG.
  5. Security Masked PAN: `•••• •••• •••• 4242` formatted in `font-mono tracking-widest text-lg`.
  6. Footer Row: Cardholder Name / Nickname (bottom-left) + Payment Network SVG (bottom-right).

### 3.2 VisualCard Component Specification (`frontend/src/components/cards/VisualCard.tsx`)
```tsx
import React from 'react';
import { CatalogCard } from '../../types/cards';
import { VisaIcon, MastercardIcon, RuPayIcon, AmexIcon, ChipIcon, ContactlessIcon } from '../icons/NetworkIcons';
import { BankLogo } from '../icons/BankIcons';

export interface VisualCardProps {
  card: Partial<CatalogCard> & {
    last_four_digits?: string;
    cardholder_name?: string;
    card_nickname?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  showDetails?: boolean;
}

export const VisualCard: React.FC<VisualCardProps> = ({
  card,
  size = 'md',
  interactive = false,
  onClick,
  className = '',
  showDetails = true,
}) => {
  const isDarkText = card.text_contrast_mode === 'dark';
  const textColor = isDarkText ? 'text-slate-900' : 'text-white';
  const textMuted = isDarkText ? 'text-slate-700/80' : 'text-white/80';
  const bgStyle = card.gradient_theme 
    ? { background: card.gradient_theme } 
    : { backgroundColor: card.card_color || '#1E293B' };

  const sizeClasses = {
    sm: 'w-64 max-w-full text-xs p-4 rounded-xl shadow-sm',
    md: 'w-80 sm:w-96 max-w-full text-sm p-6 rounded-2xl shadow-card hover:shadow-card-hover',
    lg: 'w-full max-w-md text-base p-7 rounded-2xl shadow-elevated',
  };

  const renderNetworkIcon = () => {
    switch (card.card_network) {
      case 'Visa': return <VisaIcon className="h-6 w-auto" />;
      case 'Mastercard': return <MastercardIcon className="h-6 w-auto" />;
      case 'RuPay': return <RuPayIcon className="h-5 w-auto" />;
      case 'Amex': return <AmexIcon className="h-7 w-auto" />;
      default: return <span className="font-bold tracking-wider">{card.card_network || 'CARD'}</span>;
    }
  };

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={bgStyle}
      className={`relative aspect-[1.586/1] flex flex-col justify-between overflow-hidden select-none transition-all duration-200 ${
        sizeClasses[size]
      } ${interactive ? 'cursor-pointer transform hover:-translate-y-1 active:scale-[0.98]' : ''} ${className}`}
    >
      {/* Specular Card Sheen & Texture */}
      <div 
        className="absolute inset-0 bg-gradient-to-tr from-black/10 via-white/5 to-white/20 pointer-events-none" 
        aria-hidden="true" 
      />

      {/* Top Header: Bank Logo + Contactless & Tier Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BankLogo bankName={card.bank_name || 'Bank'} className={`h-6 w-auto ${textColor}`} />
          <span className={`font-semibold tracking-tight text-xs uppercase opacity-90 ${textColor}`}>
            {card.bank_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ContactlessIcon className={`w-4 h-4 opacity-75 ${textColor}`} />
          {card.card_level && (
            <span 
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-current opacity-80"
              style={{ color: card.accent_color || 'inherit' }}
            >
              {card.card_level}
            </span>
          )}
        </div>
      </div>

      {/* Hardware Mid-Row: Chip */}
      <div className="relative z-10 my-auto flex items-center">
        <ChipIcon className="w-10 h-7" />
      </div>

      {/* Bottom Info: Masked Digits + Name + Network */}
      <div className="relative z-10 space-y-2">
        {showDetails && (
          <div className={`font-mono tracking-widest text-base sm:text-lg font-medium ${textColor}`}>
            •••• •••• •••• {card.last_four_digits || '••••'}
          </div>
        )}
        <div className="flex items-end justify-between">
          <div className="max-w-[70%] truncate">
            <p className={`text-[10px] uppercase tracking-wider font-medium ${textMuted}`}>
              {card.card_nickname || card.card_name || 'Credit Card'}
            </p>
            <p className={`text-xs font-semibold uppercase tracking-wide truncate ${textColor}`}>
              {card.cardholder_name || 'Cardholder'}
            </p>
          </div>
          <div className={`flex items-center justify-end ${textColor}`}>
            {renderNetworkIcon()}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Step-by-Step Implementation Guide
1. **Create VisualCard Component**:
   - Create `frontend/src/components/cards/VisualCard.tsx` implementing the exact ID-1 aspect ratio, responsive dimensions, and SVG chip/emblems.
2. **Implement Skeleton Loading State**:
   - Add `<VisualCardSkeleton />` with pulsing shimmer effect (`animate-pulse`) for seamless initial dashboard and portfolio loading.
3. **Refactor Existing Card Usages**:
   - Replace legacy card markup in `frontend/src/pages/MyCardsPage.tsx`.
   - Update `frontend/src/pages/DashboardPage.tsx` card carousel/grid to use `<VisualCard size="sm" />`.
   - Update `frontend/src/pages/RequestsPage.tsx` card summary badges to reference `<VisualCard size="sm" />`.
4. **Card Details Modal Integration**:
   - Clicking a card with `interactive={true}` opens a high-fidelity modal displaying card benefits, reward tier, associated offers, and edit/delete controls.

---

## 5. Security, Privacy & Integrity Boundaries
- **Strict Masking of Primary Account Numbers (PAN)**: Never accept or display more than the last 4 digits of a card on the visual card canvas.
- **No Client Expiry or CVV Display**: Physical card simulation MUST NOT display CVV or unmasked sensitive numbers on public or shared screens.

---

## 6. Acceptance Criteria Checklist
- [ ] `VisualCard.tsx` adheres strictly to ISO/IEC 7810 ID-1 aspect ratio ($1.586:1$).
- [ ] Bank name/logo, chip, contactless indicator, card level badge, and network logo render cleanly.
- [ ] Text color dynamically adjusts based on `text_contrast_mode` to ensure WCAG AA compliance.
- [ ] `MyCardsPage` and `DashboardPage` fully adopt `VisualCard.tsx` with zero visual regressions.
- [ ] Component handles undefined/loading card properties gracefully with fallback indicators.

---

## 7. Verification & Test Plan
1. **Visual Testing**:
   - Test rendering for 5 distinct cards:
     - Dark card (HDFC Infinia)
     - Blue card (SBI Cashback)
     - Red card (Axis Magnus)
     - Light/Silver card (Amex Platinum)
     - Fallback custom card
2. **Responsive Checks**:
   - Verify card does not horizontally overflow small 360px mobile viewports.
