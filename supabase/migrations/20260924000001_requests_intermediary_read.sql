-- Bug found while building the frontend adapter (issue #3 Phase C): requests_party_read
-- only covers requester_id/owner_id, so the intermediary in a second-degree referral has
-- no way to SELECT the request row and see it's awaiting their decision — respond_to_referral()
-- exists but nothing lets an intermediary list what's pending. Root-cause fix in RLS, not a
-- frontend workaround, since any future client hits the same gap.
create policy requests_intermediary_read on requests for select to authenticated
  using (intermediary_id = (select auth.uid()));
