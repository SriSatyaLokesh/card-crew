# Squad Decisions

## Active Decisions

- **2026-09-15 — Supabase adopted for DB + Auth.** Postgres hosting moves to Supabase (DATABASE_URL points at Supabase connection string). Auth moves from custom scrypt password_hash to Supabase Auth (JWT-based); User model drops password_hash, keys off Supabase user id. Backend reworking B2 accordingly before B3 install/verify.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
