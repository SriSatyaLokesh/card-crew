# Title: feat(design-system): Modern Trust design system, Card Crew vector logo, and SVG favicon

**Labels**: `frontend`, `ui`, `design-system`, `branding`, `p1-high`  
**Milestone**: Milestone 1 - Design System, Iconography & Brand Identity  

---

## 1. User Story
**As a** Card Crew user,  
**I want** a cohesive, modern, and accessible design system with a bespoke Card Crew brand identity (vector logo and favicon),  
**So that** the application conveys financial-grade reliability, complies with WCAG AA accessibility standards, looks crisp on high-DPI retina displays, and provides a polished, intuitive user experience.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 8: Aesthetic and Minimalist Design, Heuristic 4: Consistency & Standards):
1. **Generic & Washed-out Styling**:
   - The current UI mixes mismatched shades of blue, raw indigo, and arbitrary hex codes (`#3B82F6`, `#4F46E5`, `#1E40AF`, `#6366F1`) with no unified token hierarchy.
   - Text contrast in multiple places (such as card secondary labels `text-gray-400` on white card backgrounds, or muted status badges) falls below WCAG AA 4.5:1 ratio (some as low as 2.4:1), causing severe eye strain.
2. **Missing Brand Identity**:
   - The application has no bespoke vector logo; it currently relies on a generic `<span role="img">💳</span> CardCrew` lockup.
   - The browser tab displays the default Vite / React favicon or a generic globe icon, severely undermining user trust during peer-to-peer card sharing.
3. **Inconsistent Elevations & Radius**:
   - Cards and containers mix `rounded-none`, `rounded-md`, `rounded-xl`, and `rounded-2xl` haphazardly.
   - Shadows swing wildly between harsh black drop-shadows (`shadow-2xl`) and invisible borders.
4. **Poor Dark Mode Groundwork**:
   - Colors are hardcoded with fixed utility classes that break when transitioning into high-contrast or dark themes.

---

## 3. Technical Specifications

### 3.1 Design System Tokens (`tailwind.config.js`)
Update `frontend/tailwind.config.js` with semantic tokens:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1', // Primary Brand (Indigo Trust)
          600: '#4F46E5', // Primary CTA Hover
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        surface: {
          light: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          dark: '#0F172A',
          'dark-card': '#1E293B',
          'dark-border': '#334155',
        },
        status: {
          success: '#10B981', // Emerald
          'success-bg': '#ECFDF5',
          warning: '#F59E0B', // Amber
          'warning-bg': '#FFFBEB',
          danger: '#EF4444',  // Rose / Crimson
          'danger-bg': '#FEF2F2',
          info: '#0EA5E9',    // Sky
          'info-bg': '#F0F9FF',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        elevated: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      borderRadius: {
        card: '1rem', // 16px
        button: '0.625rem', // 10px
        badge: '9999px',
      }
    },
  },
  plugins: [],
};
```

### 3.2 Bespoke Card Crew Brand Logo (`Logo.tsx`)
Create a production vector SVG component `frontend/src/components/common/Logo.tsx`:
- **Concept**: Two overlapping credit cards angled at 15 degrees whose contours form a stylized, interlocking "C" shield, symbolizing peer-to-peer card sharing, security, and mutual trust.
- **Attributes**:
  - Scales cleanly from 24px (favicon / mobile header) to 256px (hero sign-in banner).
  - Configurable variants: `'icon-only' | 'full' | 'monochrome'`.

```tsx
import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon-only' | 'monochrome';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  variant = 'full',
  size = 'md' 
}) => {
  const sizeMap = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-12'
  };

  return (
    <div className={`flex items-center gap-2.5 font-bold tracking-tight select-none ${className}`}>
      <svg 
        className={`${sizeMap[size]} w-auto aspect-square`} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Card Crew Logo"
      >
        <defs>
          <linearGradient id="primaryCard" x1="4" y1="8" x2="36" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4F46E5" />
            <stop offset="1" stopColor="#3730A3" />
          </linearGradient>
          <linearGradient id="secondaryCard" x1="12" y1="14" x2="44" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06B6D4" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>
        </defs>
        {/* Back Card (Interlocking) */}
        <rect x="14" y="6" width="30" height="20" rx="4" fill="url(#secondaryCard)" fillOpacity="0.85" transform="rotate(8 14 6)" />
        {/* Front Card (Bold Shield Form) */}
        <rect x="4" y="14" width="32" height="22" rx="4.5" fill="url(#primaryCard)" />
        {/* Card Crew Emblem / Chip Motif */}
        <rect x="8" y="19" width="7" height="5.5" rx="1.5" fill="#FCD34D" />
        <circle cx="28" cy="27" r="3.5" fill="#FFFFFF" fillOpacity="0.4" />
        <circle cx="23" cy="27" r="3.5" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
      {variant === 'full' && (
        <span className="text-slate-900 dark:text-white font-extrabold text-xl tracking-tight">
          Card<span className="text-brand-600">Crew</span>
        </span>
      )}
    </div>
  );
};
```

### 3.3 SVG Favicon & Head Metadata
Create `frontend/public/favicon.svg` with the standalone interlocking vector mark.  
Update `frontend/index.html`:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" href="/favicon.ico" />
<meta name="theme-color" content="#4F46E5" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## 4. Step-by-Step Implementation Guide
1. **Configure Tailwind & Typography**:
   - Update `frontend/tailwind.config.js` with the unified color palette, font families, radius, and shadows.
   - Inject the Google Fonts link for *Plus Jakarta Sans* into `frontend/index.html`.
2. **Build and Export Brand Logo**:
   - Implement `frontend/src/components/common/Logo.tsx`.
   - Create `frontend/public/favicon.svg`.
   - Update `frontend/index.html` title to `Card Crew — Smarter Peer Card Sharing & Benefits`.
3. **Refactor Application Shell**:
   - In `frontend/src/components/Sidebar.tsx`: Replace emoji lockup with `<Logo variant="full" size="md" />`.
   - In `frontend/src/components/Navbar.tsx`: Ensure mobile branding renders cleanly with `<Logo variant="full" size="sm" />`.
   - In `frontend/src/pages/AuthPage.tsx`: Place `<Logo variant="full" size="xl" />` at the top of the auth card.
4. **Button & Input Component Standardization**:
   - Standardize base styles in `frontend/src/index.css` for `.btn-primary`, `.btn-secondary`, `.input-base`, and `.badge`.
   - Ensure all interactive elements have visible `:focus-visible` ring indicators (`ring-2 ring-brand-500 ring-offset-2`).

---

## 5. Security, Privacy & Integrity Boundaries
- **No Third-Party Tracking Assets**: Font styles must use preconnect or self-hosted font definitions. No tracker scripts inside the favicon or SVG assets.
- **Strict SVG Syntax**: All SVG attributes must be lowerCamelCase in JSX to eliminate React console warnings.

---

## 6. Acceptance Criteria Checklist
- [ ] `tailwind.config.js` updated with semantic palette (`brand`, `surface`, `status`) and typography.
- [ ] Bespoke `Logo.tsx` created and tested in sm/md/lg/xl and full/icon-only variants.
- [ ] `favicon.svg` deployed and correctly referenced in `frontend/index.html`.
- [ ] All interactive buttons and inputs have consistent radius, padding, and `:focus-visible` styling.
- [ ] Text contrast across all primary, secondary, and badge elements meets WCAG AA (minimum 4.5:1 for normal text, 3:1 for large text).
- [ ] Dark theme variables defined cleanly without layout breaking.

---

## 7. Verification & Test Plan
1. **Lighthouse Audit**: Run Chrome DevTools Lighthouse on `/dashboard` and `/auth`. Accessibility score must be $\ge 95/100$.
2. **Cross-Browser Favicon Test**: Verify favicon renders on Chrome, Safari, Firefox, and Edge tab bars.
3. **Visual Regression**: Test mobile (390px) and desktop (1440px) headers for brand alignment and logo clarity.
