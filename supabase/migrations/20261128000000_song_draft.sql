-- Personal song: the user makes ONE song on the phone BEFORE the gift exists, and the gift reuses that exact MP3.
-- Needs 20261127000000_bgvideo.sql first (this re-creates create_gift from that version).

-- One row per song the user made on the song screen. id = a uuid made by the app for this create flow,
-- so "one song per video" is enforced per flow, not per button press.
create table public.song_drafts (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  template_id text not null,
  inputs      jsonb not null default '{}'::jsonb,
  prompt_hash text,
  audio_path  text,                         -- bucket gift-media
  tries       smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index song_drafts_user_day on public.song_drafts (user_id, created_at desc);
alter table public.song_drafts enable row level security;  -- no policies: only the backend (secret key) touches it

-- The user's choices stay with the gift (fallback prompt, support).
alter table public.gift_songs add column prefs jsonb;

-- Same as the previous version, plus audio_path (the approved draft) and prefs in the gift_songs insert.
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
           'movie_json', t.movie_json, 'song_json', t.song_json, 'duration_sec', t.duration_sec,
           'color_from', t.color_from, 'color_to', t.color_to, 'render_config', t.render_config,
           'video_prompt', t.video_prompt, 'updated_at', t.updated_at,
           'bgvideo_path', t.bgvideo_path, 'bgvideo_mode', t.bgvideo_mode, 'bgvideo_window', t.bgvideo_window
         )
  from public.price_tiers pt where pt.id = t.price_tier_id
  returning * into g;

  insert into public.gift_photos (gift_id, storage_path, position)
  select g.id, path, (ord - 1)::smallint
  from unnest(p_photo_paths) with ordinality as u(path, ord);

  if p_song is not null then
    insert into public.gift_songs (
      gift_id, source, mood, singer, version, lyrics,
      upload_path, upload_file_name, upload_duration_sec, trim_start_sec, fade,
      audio_path, prefs
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
      coalesce((p_song ->> 'fade')::boolean, true),
      nullif(p_song ->> 'audio_path', ''),
      p_song -> 'prefs'
    );
  end if;

  return g;
end $$;
revoke execute on function public.create_gift from public, anon, authenticated;
