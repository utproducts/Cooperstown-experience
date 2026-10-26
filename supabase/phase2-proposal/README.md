# Phase 2 proposal: family features in the Cooperstown database

Production data lives in Chad's Supabase project **cooperstown** (`lkyrieejwifdbnhzcrul`). Its schema and rules are in
`utproducts/cooperstown`. The app reads and writes those tables directly (`src/data/cooperstown.ts`).

That database doesn't yet have tables for the family-side features: parent accounts and team follows, player rosters
with QR check-in passes, push alerts, meeting bookings, and photo orders. This folder is the draft for those:
migrations, edge functions (push fan-out, invite emails, Stripe checkout) and an RLS test suite
(`npm run test:db`). They were written against an earlier standalone schema (`events`, `games` with uuid ids, …).
Before they're applied they have to be adapted to Chad's tables (`weeks`, `teams`, `games` with bigint ids, `staff`),
and the migrations go in `utproducts/cooperstown` so both apps share them.

**Nothing in this folder has been applied to any database.** Applying it changes production, so Chad and the owner
sign off first.
