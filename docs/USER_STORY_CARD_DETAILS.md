# User Story: Capture Complete Card Identity

Status: ready for Backend + Frontend implementation
Priority: MVP enhancement / catalog accuracy

## Story

As a Card Crew user,
I want to add the exact card product, network, tier, physical variant, co-brand, and linked-card context I hold,
so that searches and requests match the right card variant instead of treating every version as the same card.

## Why This Matters

A card name alone is not a reliable identity. Official issuer pages show materially different dimensions:

- **HDFC Infinia:** the official page identifies an `Infinia Metal Credit Card`, marked `By Invite Only`, and describes benefits for primary and add-on cardholders. The metal edition must not be collapsed into a generic Infinia row.
- **Axis Atlas:** the official page describes an airlines-agnostic travel card with Silver, Gold, and Platinum benefit tiers, milestone spends, lounge benefits, and an add-on-card eligibility path. Tier/edition is meaningful metadata.
- **Amazon Pay ICICI:** the official page shows Amazon Pay + ICICI co-branding, Visa branding, Amazon/Prime-specific rewards, and an add-on-card FAQ. Partner and network are separate identity fields.

Official sources reviewed:

- [HDFC Infinia](https://www.hdfc.bank.in/credit-cards/infinia-credit-card)
- [Axis Atlas](https://www.axis.bank.in/cards/credit-card/axis-bank-atlas-credit-card)
- [Amazon Pay ICICI](https://www.icici.bank.in/personal-banking/cards/credit-card/amazon-pay-credit-card)

These pages also demonstrate why benefits, eligibility, fees, and terms should be treated as dated source content rather than permanent card identity. The product catalog should store stable metadata first and add source/versioned benefit records separately.

## Card Identity Model

### Stable catalog identity

These fields identify a product or product variant:

- `issuer`: HDFC, Axis, ICICI, SBI Card, etc.
- `product_name`: Infinia, Atlas, Amazon Pay, etc.
- `card_category`: credit, debit, charge, prepaid.
- `card_type`: credit, debit, charge, co-branded.
- `network`: Visa, Mastercard, RuPay, American Express, Diners Club.
- `network_variant`: optional network program or edition label.
- `variant_name`: Metal, Signature, Infinite, Platinum, Gold, Select, World, etc.
- `tier`: Entry, Gold, Platinum, Premium, Super Premium, or issuer-defined tier.
- `physical_form`: plastic, metal, virtual, digital, unknown.
- `co_brand_partner`: Amazon Pay, Flipkart, Swiggy, Tata Neu, Airtel, IRCTC, ixigo, etc.
- `upi_enabled`: whether this specific variant can be linked to UPI under the issuer/network rules.
- `country`: launch/availability country.
- `active`: whether the catalog product is currently selectable.
- `source_url`: official issuer/product page for review.
- `source_checked_at`: when the official source was last reviewed.

### User-held card context

These fields belong to the user's resource, not the shared catalog:

- `catalog_card_id`: exact selected catalog variant.
- `ownership_kind`: primary, add-on/supplementary, authorized user, unknown.
- `linked_account_kind`: bank account, credit line, prepaid balance, unknown.
- `physical_or_virtual`: physical, virtual, both, unknown.
- `custom_variant_note`: short user-entered metadata only; no secrets.
- `visibility` and `request_enabled`: existing privacy controls.

Never collect or store card number, last four digits, CVV, PIN, OTP, expiry, bank login, UPI PIN, or card credentials. Even a last-four field is intentionally excluded from this story because it is not needed for network discovery.

## Backend Work

### B-CARD-1: Expand catalog schema

Add stable metadata fields to `CardCatalog`:

```text
network_variant nullable
variant_name nullable
 tier nullable
physical_form nullable
co_brand_partner nullable
source_url nullable
source_checked_at nullable
```

Keep existing `issuer`, `product_name`, `card_type`, `card_category`, `network`, `upi_enabled`, `use_cases`, `country`, and `active` fields.

Add a `UserCard`/`Resource` context field:

```text
ownership_kind: primary | add_on | authorized_user | unknown
linked_account_kind: bank_account | credit_line | prepaid | unknown
physical_or_virtual: physical | virtual | both | unknown
custom_variant_note nullable
```

Use a migration with safe defaults and preserve all current resources.

### B-CARD-2: Normalize catalog identity

- Treat Visa, Mastercard, RuPay, American Express, and Diners Club as separate network values.
- Treat Metal, Signature, Infinite, Platinum, Gold, World, and issuer-specific tiers as variant/tier metadata, not separate free-text notes.
- Represent co-brand partner separately from issuer. Example: issuer `ICICI`, partner `Amazon Pay`, network `Visa`.
- Allow multiple catalog rows for meaningful combinations. Example: `Tata Neu Infinity - RuPay` and `Tata Neu Infinity - Visa` must not overwrite one another.
- Use deterministic IDs based on normalized identity, for example:
  `icici-amazon-pay-credit-visa`, `hdfc-infinia-metal-mastercard`, `axis-atlas-visa-platinum`.
- Avoid claiming a product is active or UPI-enabled unless an official source confirms it.

### B-CARD-3: Catalog source and freshness

- Add an admin/import path later for official source URLs and review timestamps.
- Do not store scraped benefits as permanent truth in the identity row.
- Add a future `CardBenefitSnapshot` table for dated benefits, reward rates, lounge rules, fees, eligibility, and terms.
- Until that table exists, the catalog may store only stable tags such as `travel`, `cashback`, `fuel`, `lifestyle`, `railway`, and `upi`.

### B-CARD-4: API contract

`GET /catalog/cards` and `GET /catalog/cards/:id` must return:

```json
{
  "id": "hdfc-infinia-metal-mastercard",
  "issuer": "HDFC",
  "product_name": "Infinia",
  "card_category": "credit",
  "card_type": "credit",
  "network": "Mastercard",
  "network_variant": null,
  "variant_name": "Metal",
  "tier": "Super Premium",
  "physical_form": "metal",
  "co_brand_partner": null,
  "upi_enabled": false,
  "use_cases": ["travel", "lifestyle", "general-spend"],
  "country": "IN",
  "active": true,
  "source_url": "https://www.hdfc.bank.in/credit-cards/infinia-credit-card",
  "source_checked_at": "2026-09-16T00:00:00.000Z"
}
```

Resource create/update APIs must accept the user-held context fields but reject secret-like fields with a 400 response.

### Backend acceptance criteria

- [ ] Two network variants of the same product can coexist without a unique-key collision.
- [ ] Co-brand issuer, partner, and network are returned independently.
- [ ] Add-on/supplementary ownership is represented without exposing the primary holder's private data.
- [ ] Existing 169 catalog rows remain valid after migration.
- [ ] Search can filter by issuer, product, network, variant, tier, co-brand partner, UPI, and use case.
- [ ] API responses contain no card number, CVV, PIN, OTP, expiry, or bank credential fields.
- [ ] Tests cover exact variant selection, duplicate prevention, invalid secret fields, and UPI/network filtering.

## Frontend Work

### F-CARD-1: Progressive add-card flow

Replace the current one-click `Add` action with a two-stage flow:

1. **Choose card identity**
   - Search issuer/product.
   - Filter by Credit, Debit, UPI, Travel, Cashback, Fuel, Lifestyle.
   - Show network, variant, tier, co-brand partner, and physical form in the result row.
2. **Confirm card details**
   - Confirm exact network: Visa, Mastercard, RuPay, American Express, Diners Club.
   - Choose variant/tier when multiple records exist.
   - Choose ownership: Primary, Add-on/Supplementary, Authorized user, Unknown.
   - Choose physical/virtual/both.
   - Show UPI capability as read-only catalog metadata.
   - Configure visibility and request permission.
   - Keep notes optional with the no-credentials warning.

### F-CARD-2: Variant clarity

Use a compact identity summary before save:

```text
HDFC Infinia
Mastercard · Metal · Super Premium
Primary card · Physical
UPI not enabled for this catalog variant
Visible to: Direct friends
Requests: Allowed
```

For co-branded cards:

```text
Amazon Pay ICICI Bank Credit Card
ICICI issuer · Amazon Pay partner · Visa
Credit · Physical
```

Never use the product name alone as the saved resource label.

### F-CARD-3: Edit and display

- Existing My Cards rows show product, issuer, network, variant, partner, ownership kind, and UPI status.
- Add an `Edit details` action for ownership/physical form/notes/privacy.
- Preserve the catalog identity after edit; changing network or product creates a new selection rather than silently mutating history.
- Show a clear empty state when an older catalog record has incomplete metadata.

### F-CARD-4: Search and request context

- Search results show the exact catalog variant held by a friend.
- The request compose copy uses the full label: `Can I ask about HDFC Infinia Metal on Mastercard?`
- Do not expose ownership context that the owner has marked private unless the API explicitly permits it.

### Frontend acceptance criteria

- [ ] User can distinguish Visa vs Mastercard vs RuPay for the same product family.
- [ ] User can distinguish Metal/Signature/Infinite/Platinum/Gold/World and issuer-defined tiers.
- [ ] User can identify co-branded partner separately from issuing bank.
- [ ] User can record primary vs add-on/supplementary ownership.
- [ ] User can record physical vs virtual context without entering card credentials.
- [ ] UPI capability is visible and filterable but not editable by the user.
- [ ] Mobile add flow remains usable at 375px with no horizontal scroll.
- [ ] Screen readers receive a complete identity summary, not only the product name.
- [ ] Loading, validation, success, and error states are present for each step.

## Example Scenarios

### Scenario A: HDFC Infinia

User selects:

```text
Issuer: HDFC
Product: Infinia
Network: Mastercard
Variant: Metal
Tier: Super Premium
Physical form: Metal
Ownership: Primary
UPI: Not enabled
Use cases: Travel, lifestyle, general spend
```

### Scenario B: Axis Atlas

User selects:

```text
Issuer: Axis
Product: Atlas
Network: Visa
Tier: Silver / Gold / Platinum
Variant: Travel
Ownership: Primary or add-on
Use cases: Travel, lounge, milestone rewards
```

The exact tier must be represented if the issuer confirms it; do not infer tier only from a user's spending.

### Scenario C: Amazon Pay ICICI

User selects:

```text
Issuer: ICICI Bank
Product: Amazon Pay
Partner: Amazon Pay
Network: Visa
Variant: Co-branded
Ownership: Primary or add-on
Use cases: Amazon, cashback, fuel, general spend
```

## Definition of Done

- Backend schema, seed, API, and tests support exact card identity and user-held context.
- Frontend add/edit flow captures the new fields progressively.
- Existing resources migrate without data loss.
- Search and request flows display the exact variant.
- Privacy rules continue to hide private resources and contact details.
- Documentation lists the official source URL and checked date for catalog facts.
