# Security Policy

Card Crew stores card *metadata* and social-graph *permissions* for real
people — never card numbers, CVVs, PINs, OTPs, or bank credentials (see
[Security Boundary](#security-boundary) below). Because the data involved is
still personally identifying and privacy-sensitive, we treat security
reports seriously and ask that they come through a private channel first.

## Supported Versions

Card Crew does not yet ship versioned releases — `main` is the only
supported branch, and it is what is deployed to production. Security fixes
land there directly; there is no older branch that still receives patches.

| Branch | Supported |
| --- | --- |
| `main` | ✅ |
| anything else | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately through GitHub's built-in flow:

1. Go to the [Security tab](https://github.com/SriSatyaLokesh/card-crew/security)
   of this repository.
2. Click **"Report a vulnerability"** to open a
   [private security advisory](https://github.com/SriSatyaLokesh/card-crew/security/advisories/new).
3. Include what you'd include in any good report: the affected
   endpoint/component, reproduction steps or a proof of concept, the
   impact you'd expect (data exposure, privilege escalation, etc.), and
   any suggested fix if you have one.

You'll get an acknowledgement as soon as a maintainer sees the advisory, and
we'll keep you updated as we investigate and fix the issue. We ask
reporters to give us reasonable time to ship a fix before any public
disclosure, and we're happy to credit you in the advisory once it's
published, if you'd like.

### What's in scope

- Authentication/authorization bypasses (including anything that lets a
  caller read or modify another user's `Resource`, `Connection`, or
  `Request` rows)
- Row Level Security (RLS) policy gaps in `supabase/` that would let a
  request bypass the intended visibility rules (direct friend / network /
  private)
- Exposure of contact details (phone/WhatsApp) without the approval gate
  described in `docs/API_CONTRACT.md`
- Injection, SSRF, or similar classic web vulnerabilities in `backend/` or
  `frontend/`
- Secrets (Supabase service role key, database URL, etc.) reachable from
  client-side code or committed to the repository

### What's already known (please still report, but see the docs first)

`docs/API_CONTRACT.md` documents a **stub-auth model**: every endpoint other
than `POST /users/sync` currently trusts a caller-supplied `user_id`
instead of verifying a session token. This is a known, tracked limitation
of the MVP, not a hidden bug — but if you find a way to exploit it beyond
what's already documented (for example, a path that leaks data *without*
needing to guess another user's id), that's still worth a report.

### Out of scope

- Reports that require physical access to a user's device
- Social engineering against maintainers or users
- Denial of service via brute-force volume alone
- Findings that only affect `backend/` in its archived, non-deployed
  capacity (see `backend/README.md`) with no equivalent in `supabase/`

## Security Boundary

This is a product rule as much as a security one, and it applies to every
contribution:

- Never add a field, log line, analytics event, or error message that
  stores or transmits a full card number, CVV, PIN, OTP, UPI PIN, or
  banking password. Card Crew's entire threat model assumes these never
  enter the system.
- Contact details (phone/WhatsApp) are revealed only after the
  direct-owner or intermediary approval path in `docs/API_CONTRACT.md`
  succeeds — never render them in the DOM or API response before that.
- Keep privacy/visibility checks server-side (RLS policy or Express route
  guard), never only in the frontend.

See the [`README`](README.md#security-boundary) and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the fuller picture of how data
flows through the system.
