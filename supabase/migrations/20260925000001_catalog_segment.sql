-- Separate card segment (retail / co-branded / corporate) from card_type (form factor)
-- and from variant (tier/rank). Today card_type's 'co-branded' value conflates a
-- partnership-structure concept with form factor, and there's no field at all for
-- "corporate card" — see issue #24.

alter table catalog_cards
  add column segment text not null default 'retail'
    check (segment in ('retail', 'co-branded', 'corporate'));

update catalog_cards set segment = 'co-branded' where card_type = 'co-branded';

-- Drop the old constraint before backfilling card_type, not after: on a database that
-- already has rows (prod), backfilling a co-branded/prepaid row to card_type='prepaid'
-- while the old check (which doesn't allow 'prepaid') is still in effect fails the
-- update outright. `supabase db reset` didn't catch this locally because it seeds an
-- empty table before this migration ever runs, so the backfill update was a no-op.
alter table catalog_cards drop constraint catalog_cards_card_type_check;

-- card_type becomes form-factor only. Backfill from card_category (equal to it for
-- every existing co-branded row, prepaid included — e.g. LazyCard is card_type
-- 'co-branded'/card_category 'prepaid' today, so it becomes card_type 'prepaid').
update catalog_cards set card_type = card_category where card_type = 'co-branded';

alter table catalog_cards
  add constraint catalog_cards_card_type_check
    check (card_type in ('credit', 'debit', 'charge', 'prepaid'));

-- column order changes (segment inserted before variant), which `create or replace view`
-- refuses (it only allows appending columns) — drop and recreate instead.
drop view catalog_cards_view;
create view catalog_cards_view with (security_invoker = true) as
  select
    ci.id, ci.name as product_name, ci.country, ci.active,
    i.name as issuer, i.slug as issuer_slug,
    cc.card_type, cc.card_category, cc.segment, cc.variant, cc.upi_enabled,
    n.name as network,
    coalesce(
      (select array_agg(uc.slug order by uc.slug)
         from catalog_card_use_cases ccu join use_cases uc on uc.id = ccu.use_case_id
        where ccu.catalog_item_id = ci.id),
      '{}'
    ) as use_cases
  from catalog_items ci
  join catalog_cards cc on cc.catalog_item_id = ci.id
  join issuers i on i.id = ci.issuer_id
  join card_networks n on n.id = cc.network_id
  where ci.item_type = 'card';
