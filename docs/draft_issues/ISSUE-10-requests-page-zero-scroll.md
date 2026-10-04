# Title: feat(requests): Complete Requests page overhaul with responsive card stack, zero horizontal scrolling, and 1-click WhatsApp hand-off

**Labels**: `frontend`, `ui`, `ux`, `mobile`, `refactor`, `p1-high`  
**Milestone**: Milestone 7 - Requests Experience Overhaul & Zero-Scroll Architecture  

---

## 1. User Story
**As a** Card Crew user reviewing or initiating peer card usage requests on my smartphone,  
**I want** incoming and outgoing requests displayed as compact, self-contained card stacks with zero horizontal scrolling and instant 1-click WhatsApp messaging,  
**So that** I can approve requests, share OTPs, and coordinate card usage seamlessly on the go without scrolling horizontally across wide tables.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 3: User control and freedom, Heuristic 4: Consistency and standards):
1. **Severe Horizontal Table Scrolling**:
   - `frontend/src/pages/RequestsPage.tsx` is an unwieldy 1,125-line monolith using a dense `<table>` structure.
   - On screens smaller than 1024px, the table overflows the container, hiding action buttons (`Approve`, `Decline`, `View Details`) off-screen to the right. Users must horizontally scroll back and forth to match the cardholder name with the action button.
2. **Ambiguous Responsibility Hierarchy**:
   - Incoming requests (which require immediate user action to approve or share OTP) are mixed together with outgoing requests (which are waiting on friends).
   - Critical time-sensitive transaction requests get lost in the noise.
3. **Friction in Real-World Coordination**:
   - When a friend needs an OTP to complete an online checkout, every second counts. The app lacks an instant one-tap hand-off to WhatsApp to send status updates.

---

## 3. Technical Specifications

### 3.1 Responsive Card Stack Architecture (`RequestItemCard.tsx`)
Replace wide table rows with clean, vertical cards:
```tsx
import React from 'react';
import { Clock, CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft, MessageCircle } from 'lucide-react';
import { CardRequest } from '../../types';

interface RequestItemCardProps {
  request: CardRequest;
  direction: 'incoming' | 'outgoing';
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onOpenChat?: (userId: string) => void;
}

export const RequestItemCard: React.FC<RequestItemCardProps> = ({
  request,
  direction,
  onApprove,
  onDecline,
  onOpenChat,
}) => {
  const isIncoming = direction === 'incoming';
  const partnerName = isIncoming ? request.requester?.full_name : request.owner?.full_name;
  const partnerPhone = isIncoming ? request.requester?.phone_number : request.owner?.phone_number;

  const whatsappMessage = encodeURIComponent(
    `Hey ${partnerName}! Regarding your Card Crew request for ${request.card?.card_name}: `
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
      {/* Top Header: Partner & Direction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isIncoming ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
            {isIncoming ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{partnerName}</h3>
            <p className="text-xs text-slate-500">{isIncoming ? 'Requested your card' : 'You requested their card'}</p>
          </div>
        </div>
        {/* Status Badge */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
          request.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
          request.status === 'declined' ? 'bg-rose-50 text-rose-700' :
          'bg-amber-50 text-amber-700'
        }`}>
          {request.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
          {request.status === 'declined' && <XCircle className="w-3.5 h-3.5" />}
          {request.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
          {request.status.toUpperCase()}
        </span>
      </div>

      {/* Card & Details Box */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Requested Card</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{request.card?.card_name}</p>
        </div>
        {request.amount && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Estimated Amount</p>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">₹{request.amount}</p>
          </div>
        )}
      </div>

      {/* Action Strip */}
      <div className="flex items-center gap-2 pt-1">
        {isIncoming && request.status === 'pending' && (
          <>
            <button
              onClick={() => onApprove?.(request.id)}
              className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Approve Request
            </button>
            <button
              onClick={() => onDecline?.(request.id)}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Decline
            </button>
          </>
        )}

        {partnerPhone && (
          <a
            href={`https://wa.me/${partnerPhone.replace(/\+/g, '')}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]"
            title="Chat on WhatsApp"
            aria-label="Chat on WhatsApp"
          >
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </a>
        )}
      </div>
    </div>
  );
};
```

### 3.2 Dual-Tab Navigation & Filter Strip
- Tab 1: **Action Required (`Incoming`)** (with unread pill indicator).
- Tab 2: **My Requests (`Outgoing`)**.
- Filter Pills: `All`, `Pending`, `Approved`, `Completed`.

---

## 4. Step-by-Step Implementation Guide
1. **Refactor `RequestsPage.tsx`**:
   - Decompose the 1,125-line file into modular components:
     - `frontend/src/components/requests/RequestItemCard.tsx`
     - `frontend/src/components/requests/NewRequestSheetModal.tsx`
     - `frontend/src/components/requests/RequestFilterTabs.tsx`
2. **Remove Wide `<table>` Elements**:
   - Replace with responsive CSS grid (`grid grid-cols-1 md:grid-cols-2 gap-4`).
3. **Add 1-Click WhatsApp Deep Linking**:
   - Construct WhatsApp API url (`https://wa.me/{phone}?text={encodedText}`).
   - Include card name and status in prefilled message.
4. **Instant Optimistic Status Updates**:
   - On clicking "Approve", optimistically update card status in UI while persisting to Supabase in the background.

---

## 5. Security, Privacy & Integrity Boundaries
- **Ownership Verification**: Users can only approve requests where they are the verified owner of the requested `user_card`.
- **Sensitive Data Isolation**: Never expose CVV or full card number on the request overview card.

---

## 6. Acceptance Criteria Checklist
- [ ] Broad table eliminated; requests render in a responsive vertical card stack.
- [ ] Zero horizontal scrollbars exist on any screen size from 360px to 1920px.
- [ ] Incoming vs Outgoing requests separated into clean, intuitive tabs.
- [ ] 1-click WhatsApp hand-off button opens WhatsApp with pre-populated message.
- [ ] Approval and decline actions execute with optimistic UI updates.
- [ ] All touch targets meet $44 \times 44\text{px}$ minimum size standard.

---

## 7. Verification & Test Plan
1. **Responsive Viewport Test**:
   - Load `/requests` on 375px mobile viewport. Confirm all actions (Approve, WhatsApp, Filter) are accessible without horizontal scrolling.
2. **Action Flow**:
   - Trigger approval on a mock incoming request; verify status changes to "Approved" immediately.
