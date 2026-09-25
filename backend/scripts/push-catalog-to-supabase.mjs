#!/usr/bin/env node
// Idempotent upsert of backend/src/catalog/card-catalog.seed.ts into a live Supabase
// project. Needed because the deploy pipeline (.github/workflows/cloudflare-pages.yml)
// deliberately only pushes schema migrations, never data (see issue #3 §Deployment) —
// supabase/seed.sql only ever gets applied by `supabase start` in CI/local dev. This is
// the one thing that actually writes the catalog to a real database.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backend/scripts/push-catalog-to-supabase.mjs
//
// Safe to re-run: every write is an upsert keyed on the same unique constraints the
// schema already defines, so running this twice does not duplicate rows.
//
// Ponytail note: table upsert logic here duplicates the parsing/dedup/use-case-inference
// found in scripts/generate-catalog-seed.js rather than sharing a module with it — same
// call that file already made ("no shared module between a Vite/Node app and a standalone
// codegen script worth introducing for eight regexes"). Keep the two in sync by hand if
// the seed tuple shape changes.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "../src/catalog/card-catalog.seed.ts");
const src = readFileSync(seedPath, "utf8");

const arrMatch = src.match(/const CARD_CATALOG_SEED: CardSeedTuple\[\] = \[([\s\S]*?)\n\];/);
if (!arrMatch) throw new Error(`could not locate CARD_CATALOG_SEED array in ${seedPath}`);

const rowRe =
  /\[\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*(null|"[^"]*"),\s*(true|false)\s*\]/g;
const rows = [];
let m;
while ((m = rowRe.exec(arrMatch[1]))) {
  const [, id, issuer, product_name, card_type, card_category, network, variantRaw, upiRaw] = m;
  rows.push({
    id,
    issuer,
    product_name,
    card_type,
    card_category,
    network,
    variant: variantRaw === "null" ? null : variantRaw.slice(1, -1),
    upi_enabled: upiRaw === "true",
  });
}
if (rows.length === 0) throw new Error("no rows parsed — has the CARD_CATALOG_SEED tuple shape changed?");

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function inferUseCases(issuer, productName, cardCategory, upiEnabled) {
  const searchable = `${issuer} ${productName}`.toLowerCase();
  const useCases = new Set([cardCategory === "debit" ? "daily-banking" : "general-spend"]);
  if (upiEnabled) useCases.add("upi");
  if (/travel|atlas|air india|ixigo|scapia|world safari|platinum|reserve|emeralde|infinia|wealth|magnus/i.test(searchable))
    useCases.add("travel");
  if (/cashback|cash back|ace|millennia|swiggy|amazon|flipkart|airtel|live\+|smart/i.test(searchable))
    useCases.add("cashback");
  if (/fuel|indianoil|bpcl|hpcl/i.test(searchable)) useCases.add("fuel");
  if (/dining|eazydiner|tata neu|myntra|swiggy|lifestyle|coral|rubyx/i.test(searchable)) useCases.add("lifestyle");
  if (/irctc|railway/i.test(searchable)) useCases.add("railway");
  if (/debit|daily/i.test(searchable) || cardCategory === "debit") useCases.add("daily-banking");
  return [...useCases];
}

// catalog_items is unique on (issuer_id, item_type, name) — no network column. A handful
// of real products are only distinguishable by network (e.g. HDFC issues "Tata Neu
// Infinity" as both RuPay and Visa); disambiguate those with a network suffix so they
// land as two rows instead of colliding into one. Mirrors generate-catalog-seed.js.
const byIssuerAndName = new Map();
for (const r of rows) {
  const key = `${r.issuer}|${r.product_name}`;
  if (!byIssuerAndName.has(key)) byIssuerAndName.set(key, []);
  byIssuerAndName.get(key).push(r);
}
for (const group of byIssuerAndName.values()) {
  if (group.length > 1) for (const r of group) r.product_name = `${r.product_name} (${r.network})`;
}

const issuerRows = [...new Map(rows.map((r) => [slug(r.issuer), r.issuer])).entries()].map(([slug_, name]) => ({
  slug: slug_,
  name,
  country: "IN",
}));
const networkRows = [...new Map(rows.map((r) => [slug(r.network), r.network])).entries()].map(([slug_, name]) => ({
  slug: slug_,
  name,
}));
const rowsWithUseCases = rows.map((r) => ({ ...r, useCases: inferUseCases(r.issuer, r.product_name, r.card_category, r.upi_enabled) }));
const useCaseRows = [...new Set(rowsWithUseCases.flatMap((r) => r.useCases))].sort().map((slug_) => ({ slug: slug_ }));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function upsert(table, values, onConflict) {
  const { data, error } = await supabase.from(table).upsert(values, { onConflict }).select();
  if (error) throw new Error(`upsert ${table} failed: ${error.message}`);
  return data;
}

const issuersOut = await upsert("issuers", issuerRows, "slug");
const issuerIdBySlug = new Map(issuersOut.map((r) => [r.slug, r.id]));

const networksOut = await upsert("card_networks", networkRows, "slug");
const networkIdBySlug = new Map(networksOut.map((r) => [r.slug, r.id]));

const useCasesOut = await upsert("use_cases", useCaseRows, "slug");
const useCaseIdBySlug = new Map(useCasesOut.map((r) => [r.slug, r.id]));

const catalogItemRows = rowsWithUseCases.map((r) => ({
  issuer_id: issuerIdBySlug.get(slug(r.issuer)),
  item_type: "card",
  name: r.product_name,
  country: "IN",
  active: true,
}));
const itemsOut = await upsert("catalog_items", catalogItemRows, "issuer_id,item_type,name");
const itemIdByIssuerAndName = new Map(itemsOut.map((r) => [`${r.issuer_id}|${r.name}`, r.id]));

const catalogCardRows = rowsWithUseCases.map((r) => {
  const catalogItemId = itemIdByIssuerAndName.get(`${issuerIdBySlug.get(slug(r.issuer))}|${r.product_name}`);
  if (!catalogItemId) throw new Error(`no catalog_items row resolved for ${r.issuer} / ${r.product_name}`);
  return {
    catalog_item_id: catalogItemId,
    card_type: r.card_type,
    card_category: r.card_category,
    network_id: networkIdBySlug.get(slug(r.network)),
    variant: r.variant,
    upi_enabled: r.upi_enabled,
  };
});
await upsert("catalog_cards", catalogCardRows, "catalog_item_id");

const useCaseLinkRows = rowsWithUseCases.flatMap((r) => {
  const catalogItemId = itemIdByIssuerAndName.get(`${issuerIdBySlug.get(slug(r.issuer))}|${r.product_name}`);
  return r.useCases.map((u) => ({ catalog_item_id: catalogItemId, use_case_id: useCaseIdBySlug.get(u) }));
});
const { error: linkError } = await supabase
  .from("catalog_card_use_cases")
  .upsert(useCaseLinkRows, { onConflict: "catalog_item_id,use_case_id", ignoreDuplicates: true });
if (linkError) throw new Error(`upsert catalog_card_use_cases failed: ${linkError.message}`);

console.log(
  `pushed ${rows.length} cards, ${issuerRows.length} issuers, ${networkRows.length} networks, ${useCaseRows.length} use cases to ${SUPABASE_URL}`
);
