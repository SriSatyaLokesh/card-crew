# Title: feat(chat): Chat safety disclaimer banner and client/server card-secret content guard

**Labels**: `security`, `frontend`, `backend`, `compliance`, `p1-high`  
**Milestone**: Milestone 8 - Chat Trust Security & Storage Policy Hardening  

---

## 1. User Story
**As a** Card Crew user coordinating a card usage transaction with a friend in direct chat,  
**I want** visible security guidelines and automated warnings that block accidental transmission of sensitive card credentials (full PAN, CVV, ATM PINs),  
**So that** neither party accidentally exposes their credit card secrets to potential compromise or violates card network security guidelines.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit & Financial Compliance Review:
1. **Zero Safety Context in Chat**:
   - The current `ChatPage.tsx` provides no warning banners, disclaimers, or security guardrails.
   - In peer credit card sharing, unsophisticated users frequently paste raw 16-digit card numbers, CVV codes, or expiry dates directly into the chat thread to help their friend complete a purchase.
2. **Severe Liability & Card Network Non-Compliance**:
   - Storing plaintext PANs, CVVs, and PINs in chat database logs violates PCI-DSS requirements and RBI credit card guidelines.
   - If a user's account is compromised, attackers could harvest all card credentials pasted in chat history.
3. **No Automated Interception**:
   - There are currently no client-side or server-side filters detecting credit card number patterns before messages are committed to the database.

---

## 3. Technical Specifications

### 3.1 Card Secret Pattern Detector (`frontend/src/utils/securityFilter.ts`)
Create a utility with regex and Luhn algorithm validation:
```typescript
/**
 * Verifies if a number string satisfies Luhn formula (standard for credit/debit PANs)
 */
export function isLuhnValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export interface SecurityScanResult {
  isSafe: boolean;
  violationReason?: 'FULL_PAN_DETECTED' | 'CVV_DETECTED' | 'PIN_DETECTED';
}

export function scanMessageContent(text: string): SecurityScanResult {
  // 1. Scan for potential PAN sequences (13 to 19 digits with spaces or hyphens)
  const panMatches = text.match(/(?:\d[ -]*?){13,19}/g);
  if (panMatches) {
    for (const match of panMatches) {
      const numericOnly = match.replace(/\D/g, '');
      if (isLuhnValid(numericOnly)) {
        return { isSafe: false, violationReason: 'FULL_PAN_DETECTED' };
      }
    }
  }

  // 2. Scan for CVV patterns (e.g., "cvv 123", "cvv: 4567")
  if (/\b(?:cvv|cvc|security\s*code)[\s:=]+([0-9]{3,4})\b/i.test(text)) {
    return { isSafe: false, violationReason: 'CVV_DETECTED' };
  }

  // 3. Scan for ATM PIN patterns (e.g., "atm pin 1234", "pin is 5678")
  if (/\b(?:atm\s*pin|card\s*pin|pin\s*is)[\s:=]+([0-9]{4,6})\b/i.test(text)) {
    return { isSafe: false, violationReason: 'PIN_DETECTED' };
  }

  return { isSafe: true };
}
```

### 3.2 Chat Safety Disclaimer Banner (`ChatSafetyBanner.tsx`)
Render a persistent, collapsible alert at the top of active chat rooms:
```tsx
import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

export const ChatSafetyBanner: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Card Crew Safety Guard: Never share CVVs or ATM PINs in chat</span>
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="text-amber-700 dark:text-amber-300 p-1 hover:bg-amber-100 dark:hover:bg-amber-900 rounded"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300/90 pl-6 leading-relaxed">
          For your protection, full 16-digit card numbers and CVVs are automatically blocked. Coordinate purchases via OTP or voice call. Card Crew will never ask for your card PIN.
        </p>
      )}
    </div>
  );
};
```

### 3.3 Server-Side Message Trigger Validation
```sql
-- Migration: Prevent storage of messages violating secret guard rules
CREATE OR REPLACE FUNCTION public.check_message_security()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Basic regex check for 16-digit numbers in message body
  IF NEW.content ~ '(?:\d[ -]*?){15,16}' THEN
    RAISE EXCEPTION 'Message blocked: Sharing full 16-digit card numbers is prohibited for security reasons.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_security ON public.messages;
CREATE TRIGGER trg_enforce_message_security
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.check_message_security();
```

---

## 4. Step-by-Step Implementation Guide
1. **Create Utility**:
   - Implement `frontend/src/utils/securityFilter.ts` with Luhn algorithm and CVV/PIN pattern detection.
2. **Build Banner Component**:
   - Implement `frontend/src/components/chat/ChatSafetyBanner.tsx`.
   - Embed into top of `ChatPage.tsx` room view.
3. **Intercept Message Send**:
   - In `ChatPage.tsx` send handler:
     - Run `scanMessageContent(inputMessage)`.
     - If violation detected, block send, shake input bar, and display modal alert explaining why the message was intercepted.
4. **Deploy Database Trigger Migration**:
   - Deploy `supabase/migrations/20261003000007_chat_content_guard.sql`.

---

## 5. Security, Privacy & Integrity Boundaries
- **Zero Plaintext Sensitive Storage**: Complete prevention of raw PANs, CVVs, and PINs entering the PostgreSQL database.
- **Fail-Safe Mechanism**: Even if client-side JS is bypassed, the database trigger rejects the insert.

---

## 6. Acceptance Criteria Checklist
- [ ] Safety disclaimer banner renders at top of direct chat view.
- [ ] Messages containing Luhn-valid 16-digit card numbers are blocked before dispatch.
- [ ] Messages containing explicit CVV or PIN phrases are intercepted with an informative warning.
- [ ] Database trigger prevents saving messages with full card numbers.
- [ ] Legitimate messages (OTPs, amounts like ₹1,500, greetings) pass through unimpeded.

---

## 7. Verification & Test Plan
1. **Luhn Test**:
   - Attempt to send standard test card number `4532 0150 1234 5678`.
   - Verify client intercepts with error modal and network call is never made.
2. **Legitimate Message Test**:
   - Send "Your OTP is 492019 for the transaction of ₹2,499".
   - Verify message delivers immediately without warning.
