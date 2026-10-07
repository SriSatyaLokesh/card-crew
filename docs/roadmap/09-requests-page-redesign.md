# Milestone 9: Requests Page Redesign (Responsive Card Layout & Zero Horizontal Scroll)

**Tracked Issue:** [#47](https://github.com/SriSatyaLokesh/card-crew/issues/47)  
**Priority:** High (Core Coordination Experience)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium / High  

---

## 1. Executive Summary & User Story

> **As a Card Crew member managing resource requests**, I want a clean, responsive, card-based Requests page that eliminates awkward horizontal scrolling, provides clear action flows (Approve, Decline, Referral), and shows rich request timelines, so that coordinating resource sharing on both mobile and desktop is effortless.

The existing `RequestsPage.tsx` has bloated to 1,125 lines. It relies on wide table layouts and horizontal overflow strips that degrade the mobile experience. This milestone refactors the Requests page into modular, card-based components with zero horizontal scrolling and instant contact hand-off.

---

## 2. Codebase Audit: Current Pain Points

| Component / Area | Current State | Target Architecture |
|---|---|---|
| **Layout Model** | Wide tabular rows with `overflow-x: auto` | Responsive vertical card stack (`RequestCard.tsx`) with zero horizontal overflow |
| **Mobile Experience** | Text and buttons clipped; requires side-swiping | Full-width mobile cards with 48px touch-friendly action buttons |
| **Separation of Concerns** | Incoming, outgoing, friends, and blocks merged into one 1125-line file | Dedicated segmented controller: **Incoming (Action Required)** vs **Outgoing (Awaiting Response)** |
| **Approval Flow** | Reveals contact details in flat text | Rich Contact Card modal with 1-click **WhatsApp**, **Call**, and **Direct Chat** shortcuts |
| **Audit Trail** | Events stored in `request_events` table but invisible in UI | Expandable request timeline modal showing creation, referral, and approval timestamps |

---

## 3. UI / UX Design & Component Structure

### 3.1 Anatomy of a Modern `RequestCard`

```
┌─────────────────────────────────────────────────────────────┐
│ [Avatar] Ramesh Kumar                           [2 hrs ago] │
│ Direct Friend (1st Degree)                                  │
├─────────────────────────────────────────────────────────────┤
│ Requested:                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [HDFC Bank Logo] HDFC Regalia Gold · Visa Platinum       │ │
│ │ Category: Credit · UPI Enabled                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Message: "Need lounge companion access at BLR Airport T2"   │
├─────────────────────────────────────────────────────────────┤
│ Actions:                                                    │
│ [ ✓ Approve & Share Contact ]         [ ✕ Decline ] [Refer] │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Approved State & Instant Contact Hand-Off

Once approved:
```
┌─────────────────────────────────────────────────────────────┐
│ Status: Approved ✓                    [Contact Details Shared]│
├─────────────────────────────────────────────────────────────┤
│ Counterparty: Ramesh Kumar (+91 98765 43210)                │
│ Quick Connect:                                              │
│ [ 💬 Open WhatsApp ]   [ 📞 Call Now ]   [ ✉️ In-App Chat ]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Steps

1. **Modular Subcomponents (`frontend/src/components/requests/`):**
   - `RequestCard.tsx`: Reusable card item rendering requester, card badge, message, and actions.
   - `IncomingRequestsList.tsx`: Filterable list of pending and approved requests directed to the user.
   - `OutgoingRequestsList.tsx`: Track user's own sent requests with status indicators (`Pending`, `Approved`, `Declined`).
   - `ContactHandoffModal.tsx`: Modal displaying verified contact information with WhatsApp and call links.
   - `RequestTimelineModal.tsx`: Visual audit trail fetching rows from `request_events`.
2. **Refactor `RequestsPage.tsx`:**
   - Decouple friendship requests and blocklists (which belong in `MyNetworkPage.tsx`).
   - Keep `RequestsPage.tsx` strictly focused on **Resource & Card Requests**.
   - Enforce CSS rule: `overflow-x: hidden; width: 100%;`.
3. **Integration with Chat & WhatsApp:**
   - Integrate with `toWhatsAppUrl(phone, message)`.
   - Provide direct link to `ChatPage.tsx` with recipient pre-selected.
4. **Testing:**
   - Verify zero horizontal scrolling across viewports: 320px, 375px, 768px, and 1024px.
   - Playwright test for approving a card request and triggering contact reveal.

---

## 5. Acceptance Criteria

- [ ] Zero horizontal scrolling exists on the Requests page at any supported viewport (320px+).
- [ ] Incoming and Outgoing card requests are cleanly segregated.
- [ ] Approving a request reveals counterparty contact information with 1-click WhatsApp, Phone, and Chat buttons.
- [ ] Request cards render rich card visual previews (Bank, Network, Tier).
- [ ] All action buttons meet the 48px mobile touch target standard.
