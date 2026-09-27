## What does this PR do?

<!-- One or two sentences. What changed, and why. -->

Closes #<!-- issue number, if any -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / chore (no behavior change)
- [ ] Test coverage

## Where

- [ ] `frontend/`
- [ ] `backend/`
- [ ] `supabase/` (schema / RLS / RPC)
- [ ] `tests/integration/`
- [ ] Docs / `README.md` / `ARCHITECTURE.md`
- [ ] CI / deployment (`.github/workflows/`, `wrangler.jsonc`)

## How was this tested?

<!-- What you ran, not just "it works". Paste relevant output if useful. -->

```bash
npm test
npm run build
```

- [ ] `npm test` and `npm run build` pass locally
- [ ] If `supabase/` changed: `supabase db reset` + `tests/integration/` pass locally
- [ ] Added or updated tests for the behavior this PR changes

## Security / privacy boundary

- [ ] This PR does not add any field, log, or response that stores or exposes card numbers, CVVs, PINs, OTPs, or bank credentials.
- [ ] This PR does not change what contact details a user can see, or when — or, if it does, I've explained the change below.
- [ ] Authorization/visibility checks for anything touched here are enforced server-side (RLS policy or route guard), not only in the frontend.

## Anything reviewers should look at closely?

<!-- Trade-offs, things you're unsure about, follow-up work you're deliberately leaving out of scope. -->
