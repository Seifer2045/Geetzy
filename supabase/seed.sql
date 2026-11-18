-- Price tiers + starter templates (same as mobile/src/api/mockData.ts). Safe to re-run.

insert into public.price_tiers (id, price_inr, play_product_id) values
  ('tier_29', 29, 'gift_video_29'),
  ('tier_39', 39, 'gift_video_39'),
  ('tier_49', 49, 'gift_video_49'),
  ('tier_99', 99, 'gift_video_99')
on conflict (id) do update set price_inr = excluded.price_inr, play_product_id = excluded.play_product_id;

insert into public.templates
  (id, name, occasion, style, price_tier_id, original_price_inr, made_count, trending, sort_order, tags, color_from, color_to, description, render_config)
values
  ('TPL-BD-0142', 'Filmy Gold', 'birthday', 'bollywood', 'tier_49', 99, 2140, true, 10,
   '{Bollywood,Birthday,Trending}', '#FFC857', '#B8410E',
   'Golden filmy frames, slow-motion zooms and a dhol-pop birthday song with their name in the chorus.',
   '{"font": "Playfair Display", "transition": "fadewhite", "textStyle": "003", "accent": "#FFC857"}'),
  ('TPL-BD-0151', 'Dil Se Hearts', 'birthday', 'bollywood', 'tier_49', null, 1410, false, 20,
   '{Bollywood,Birthday}', '#FF7AA8', '#8E1650',
   'Soft pink hearts, shimmer and a sweet melody that sings their name twice.',
   '{"font": "Playfair Display", "transition": "dissolve", "textStyle": "002", "accent": "#FF7AA8"}'),
  ('TPL-BD-0163', 'Sitara Night', 'birthday', 'bollywood', 'tier_39', 79, 640, false, 30,
   '{Bollywood,Birthday}', '#B39DFF', '#2E1A6B',
   'Starry night sky, sparkles and a dreamy filmy chorus.',
   '{"font": "Playfair Display", "transition": "fade", "textStyle": "002", "accent": "#B39DFF"}'),
  ('TPL-BD-0207', 'Neon Pop', 'birthday', 'genz', 'tier_49', null, 1630, true, 40,
   '{Gen Z,Birthday,Trending}', '#3DF5C8', '#5B2BD8',
   'Fast cuts, neon stickers and bold captions on a hyperpop beat.',
   '{"font": "Poppins", "transition": "slideleft", "textStyle": "005", "accent": "#3DF5C8"}'),
  ('TPL-BD-0311', 'VHS ’90s', 'birthday', 'retro', 'tier_39', null, 980, true, 50,
   '{Retro,Birthday,Trending}', '#FF9E6B', '#7A1E5C',
   'Tape grain, scan lines and a 90s synth birthday jingle.',
   '{"font": "VT323", "transition": "pixelize", "textStyle": "004", "accent": "#FF9E6B"}'),
  ('TPL-AN-0102', 'Shaadi Lights', 'anniversary', 'bollywood', 'tier_99', 149, 860, true, 60,
   '{Bollywood,Anniversary}', '#FF9E3D', '#5B1E8C',
   'Fairy lights, marigold petals and a romantic duet with both your names.',
   '{"font": "Playfair Display", "transition": "fadewhite", "textStyle": "002", "accent": "#FF9E3D"}'),
  ('TPL-AN-0118', 'Golden Years', 'anniversary', 'retro', 'tier_49', null, 420, false, 70,
   '{Retro,Anniversary}', '#FF8A5C', '#E0306E',
   'Polaroid frames and a warm vintage love song.',
   '{"font": "Lora", "transition": "fadeblack", "textStyle": "002", "accent": "#FF8A5C"}'),
  ('TPL-AP-0104', 'Sorry Na', 'apology', 'genz', 'tier_29', 49, 1210, true, 80,
   '{Gen Z,Apology}', '#6C8CFF', '#4B2BC8',
   'Cute stickers, puppy-eyes zooms and a funny sorry song.',
   '{"font": "Poppins", "transition": "slideup", "textStyle": "005", "accent": "#6C8CFF"}'),
  ('TPL-AP-0122', 'Maaf Karo', 'apology', 'bollywood', 'tier_49', null, 530, false, 90,
   '{Bollywood,Apology}', '#7FB2FF', '#24306E',
   'Rain, slow-mo and a dramatic filmy apology track.',
   '{"font": "Playfair Display", "transition": "fadeblack", "textStyle": "003", "accent": "#7FB2FF"}')
on conflict (id) do update set
  name = excluded.name, occasion = excluded.occasion, style = excluded.style, price_tier_id = excluded.price_tier_id,
  original_price_inr = excluded.original_price_inr, trending = excluded.trending, sort_order = excluded.sort_order,
  tags = excluded.tags, color_from = excluded.color_from, color_to = excluded.color_to,
  description = excluded.description, render_config = excluded.render_config;
