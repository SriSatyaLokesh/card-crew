# Title: feat(mobile): Mobile-first ergonomic overhaul with BottomNavBar, SheetModal, and 48px touch targets

**Labels**: `frontend`, `mobile`, `ui`, `ux`, `accessibility`, `p1-high`  
**Milestone**: Milestone 5 - Mobile-First Experience & Ergonomics  

---

## 1. User Story
**As a** mobile user on an iPhone or Android smartphone,  
**I want** standard bottom-thumb navigation, bottom-sheet slide-up modals, and comfortable 48px touch targets,  
**So that** I can easily manage my cards, approve incoming requests, and chat with friends single-handedly without awkward top-screen reaches, virtual keyboard clippings, or horizontal page overflows.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 4: Consistency and standards, Heuristic 7: Flexibility and efficiency of use):
1. **Broken Mobile Navigation**:
   - The desktop sidebar is hidden on mobile screens (`md:flex hidden`), but there is NO persistent bottom navigation bar. Mobile users are stranded without easy top-level navigation.
2. **Virtual Keyboard Modal Occlusion**:
   - Modals in `RequestsPage.tsx` and `MyCardsPage.tsx` are centered desktop popups (`fixed inset-0 flex items-center justify-center`).
   - When an on-screen keyboard appears on iOS or Android, the modal inputs are pushed off-screen or clipped by the browser address bar, making form submission nearly impossible.
3. **Sub-48px Touch Target Failures**:
   - Many icon buttons, filter tabs, and action pills have touch targets as small as $28 \times 28\text{px}$, causing severe misclicks and violating Apple HIG and Google Material guidelines ($48 \times 48\text{px}$ minimum).
4. **Horizontal Overflow & Page Breakages**:
   - Broad data tables and rigid widths (`min-w-[600px]`) cause horizontal viewport blowout on standard $375\text{px}$ to $414\text{px}$ mobile screens.

---

## 3. Technical Specifications

### 3.1 Mobile Bottom Navigation Component (`frontend/src/components/navigation/BottomNavBar.tsx`)
- **Fixed Position**: `fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800`.
- **Safe Area Inset**: `pb-[env(safe-area-inset-bottom)]`.
- **Items**:
  1. **Home**: `<LayoutDashboard />` $\rightarrow$ `/dashboard`
  2. **My Cards**: `<CreditCard />` $\rightarrow$ `/cards`
  3. **Requests**: `<ArrowLeftRight />` $\rightarrow$ `/requests` (with red unread count badge)
  4. **Chat**: `<MessageSquare />` $\rightarrow$ `/chat` (with unread messages counter)
  5. **Crew**: `<Users />` $\rightarrow$ `/friends`
- **Ergonomics**: Minimum touch area $48 \times 48\text{px}$ per item with subtle active scale animation and indicator dot.

```tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CreditCard, ArrowLeftRight, MessageSquare, Users } from 'lucide-react';

interface BottomNavBarProps {
  pendingRequestsCount?: number;
  unreadMessagesCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  pendingRequestsCount = 0,
  unreadMessagesCount = 0,
}) => {
  const navItems = [
    { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Cards', path: '/cards', icon: CreditCard },
    { label: 'Requests', path: '/requests', icon: ArrowLeftRight, badge: pendingRequestsCount },
    { label: 'Chat', path: '/chat', icon: MessageSquare, badge: unreadMessagesCount },
    { label: 'Crew', path: '/friends', icon: Users },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] w-full py-1 text-[11px] font-medium transition-colors ${
                isActive 
                  ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`
            }
          >
            <div className="relative">
              <item.icon className="w-5 h-5 mb-0.5" />
              {!!item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
```

### 3.2 Responsive Sheet Modal Component (`frontend/src/components/common/SheetModal.tsx`)
- On screens `< 768px` (mobile): Renders as a bottom sheet that slides up from the viewport bottom with a grab handle bar, resting above the virtual keyboard.
- On screens `≥ 768px` (desktop): Renders as a standard centered dialog with backdrop blur.

```tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const SheetModal: React.FC<SheetModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      {/* Modal / Sheet Container */}
      <div className="relative z-10 w-full md:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Mobile Drag Indicator */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Step-by-Step Implementation Guide
1. **Implement `BottomNavBar.tsx`**:
   - Add component to `frontend/src/components/navigation/BottomNavBar.tsx`.
   - Embed into root layout `App.tsx` or `Layout.tsx`, padding the main container bottom with `pb-20 md:pb-6` to avoid content occlusion.
2. **Implement `SheetModal.tsx`**:
   - Build reusable component in `frontend/src/components/common/SheetModal.tsx`.
   - Replace old desktop-only modal wrappers in `AddCardModal`, `NewRequestModal`, and `FriendSearchModal`.
3. **Audit Touch Targets Repository-Wide**:
   - Verify all buttons and interactive chips have minimum dimension classes `min-h-[44px] min-w-[44px]` (or `p-3`).
4. **Fix Horizontal Overflow**:
   - Replace rigid table structures on mobile with flex/card stacks (`grid grid-cols-1 md:table`).

---

## 5. Security, Privacy & Integrity Boundaries
- **Body Scroll Locking**: Ensure modal unmount cleanly restores `document.body.style.overflow` under all unmounting conditions (including browser navigation back gestures).
- **Z-Index Discipline**: Standardize z-indices: navigation (`z-40`), modal backdrop (`z-50`), tooltips/toasts (`z-60`).

---

## 6. Acceptance Criteria Checklist
- [ ] Bottom navigation bar is visible and fully functional on screens $< 768\text{px}$.
- [ ] Safe-area-inset is respected on iOS devices (no overlap with the home indicator bar).
- [ ] Modals slide up smoothly from the bottom on mobile devices.
- [ ] All interactive touch targets measure at least $44 \times 44\text{px}$.
- [ ] Zero horizontal scrollbars appear on standard iPhone (375px/390px) and Android (360px) viewports.

---

## 7. Verification & Test Plan
1. **Viewport Simulation**:
   - In Chrome DevTools, test responsive presets: iPhone 12/13/14 (390x844), Pixel 7 (412x915), iPhone SE (375x667).
2. **Keyboard Emulation**:
   - Focus an input inside `SheetModal` and verify that content remains accessible without off-screen clipping.
