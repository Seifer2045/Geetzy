-- Price tiers only. Safe to re-run.
-- Templates are NOT seeded any more: every template in the app comes from the database, built in the admin dashboard
-- (Templates -> New). The old made-up starter templates (Filmy Gold, Neon Pop, ...) were removed on purpose.
-- Offline mock mode (EXPO_PUBLIC_USE_MOCK=true) still has its own sample data in mobile/src/api/mockData.ts.

insert into public.price_tiers (id, price_inr, play_product_id) values
  ('tier_29', 29, 'gift_video_29'),
  ('tier_39', 39, 'gift_video_39'),
  ('tier_49', 49, 'gift_video_49'),
  ('tier_99', 99, 'gift_video_99')
on conflict (id) do update set price_inr = excluded.price_inr, play_product_id = excluded.play_product_id;
