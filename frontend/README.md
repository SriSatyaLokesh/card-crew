# Frontend

Vite + React + TypeScript client for Card Crew, implementing F1-F4 (app shell, My Network, My Cards,
search-first home). See [docs/FRONTEND_PLAN.md](../docs/FRONTEND_PLAN.md) for the full task breakdown,
API contract reference, and known gaps.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

Run the backend (`cd ../backend && npm run dev`) against the same Supabase project first.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — type-check only
