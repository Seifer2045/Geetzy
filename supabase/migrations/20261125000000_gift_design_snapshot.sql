-- Geetzy — freeze the template's design on each gift (2026-11-25)
-- Problem: the HD video is rendered AFTER payment from the live template. If the admin edits or regenerates the
-- Grok movie JSON between the user's preview and their payment, the user gets a different video than they saw.
-- Fix: copy the look-defining template fields onto the gift when it is created; the backend renders from that copy.
-- (Old gifts have design = null and keep using the live template.)

alter table public.gifts add column design jsonb;

create or replace function public.create_gift(
  p_user_id uuid,
  p_template_id text,
  p_recipient_name text,
  p_sender_name text,
  p_fun_fact text,
  p_photo_paths text[],
  p_song jsonb
) returns public.gifts
language plpgsql as $$
declare
  t public.templates;
  g public.gifts;
begin
  if exists (select 1 from public.profiles where id = p_user_id and blocked_at is not null) then
    raise exception 'blocked';
  end if;

  select * into t from public.templates where id = p_template_id and is_active and status = 'published';
  if not found then
    raise exception 'template_not_found';
  end if;
  if coalesce(array_length(p_photo_paths, 1), 0) not between t.photos_min and t.photos_max then
    raise exception 'photo_count';
  end if;

  insert into public.gifts (user_id, template_id, occasion, recipient_name, sender_name, fun_fact, price_inr, progress, design)
  select p_user_id, t.id, t.occasion, p_recipient_name, p_sender_name, coalesce(p_fun_fact, ''),
         coalesce(t.custom_price_inr, pt.price_inr), 0.05,
         jsonb_build_object(
           'movie_json', t.movie_json, 'duration_sec', t.duration_sec, 'color_from', t.color_from, 'color_to', t.color_to,
           'render_config', t.render_config, 'video_prompt', t.video_prompt, 'updated_at', t.updated_at
         )
  from public.price_tiers pt where pt.id = t.price_tier_id
  returning * into g;

  insert into public.gift_photos (gift_id, storage_path, position)
  select g.id, path, (ord - 1)::smallint
  from unnest(p_photo_paths) with ordinality as u(path, ord);

  if p_song is not null then
    insert into public.gift_songs (
      gift_id, source, mood, singer, version, lyrics,
      upload_path, upload_file_name, upload_duration_sec, trim_start_sec, fade
    ) values (
      g.id,
      (p_song ->> 'source')::public.song_source,
      (p_song ->> 'mood')::public.song_mood,
      (p_song ->> 'singer')::public.song_singer,
      (p_song ->> 'version')::smallint,
      nullif(p_song ->> 'lyrics', ''),
      p_song ->> 'upload_path',
      p_song ->> 'upload_file_name',
      (p_song ->> 'upload_duration_sec')::real,
      coalesce((p_song ->> 'trim_start_sec')::real, 0),
      coalesce((p_song ->> 'fade')::boolean, true)
    );
  end if;

  return g;
end $$;
revoke execute on function public.create_gift from public, anon, authenticated;
