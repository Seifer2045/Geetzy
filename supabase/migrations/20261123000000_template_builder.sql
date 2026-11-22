-- Geetzy — Template Builder (2026-11-23)
-- ElevenLabs replaces Gemini/Lyria/Loudly. Admin uploads art (no AI art). Optional custom price,
-- template's own song (cropped to 15 s), caption prompt, and cost-saving caches.

-- ─────────────────────────────────────────────────────────── templates
alter table public.templates
  add column video_prompt          text    not null default '',   -- caption/headline text with {name} {sender} {fun_fact} {occasion}
  add column custom_price_inr      integer check (custom_price_inr is null or custom_price_inr between 1 and 9999),
  add column default_song_path     text,                          -- bucket template-media: admin's own song (full file)
  add column default_song_start_sec real   not null default 0 check (default_song_start_sec >= 0), -- 15 s window start
  add column song_instrumental     boolean not null default false, -- ElevenLabs: no vocals
  add column art_upload_path       text,                          -- bucket template-media: background the admin uploaded (optional)
  add column auto_preview          boolean not null default false; -- 'Save & generate preview': start the preview as soon as the art is ready

-- song_mode gets 'fixed' = every gift uses the template's own cropped song (no user choice, no AI cost).
-- The API shows 'fixed' to the app as 'none' (the app just skips the song step).
alter table public.templates drop constraint if exists templates_song_mode_check;
alter table public.templates add constraint templates_song_mode_check
  check (song_mode in ('ai', 'upload', 'both', 'none', 'fixed'));

-- one song provider now
alter table public.templates drop constraint if exists templates_song_provider_check;
update public.templates set song_provider = null;
alter table public.templates add constraint templates_song_provider_check
  check (song_provider is null or song_provider = 'elevenlabs');

-- a fixed-song template needs its song
alter table public.templates add constraint templates_fixed_song_check
  check (song_mode <> 'fixed' or default_song_path is not null) not valid;

-- ─────────────────────────────────────────────────────────── create_gift: custom price wins over the tier price
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

  insert into public.gifts (user_id, template_id, occasion, recipient_name, sender_name, fun_fact, price_inr, progress)
  select p_user_id, t.id, t.occasion, p_recipient_name, p_sender_name, coalesce(p_fun_fact, ''),
         coalesce(t.custom_price_inr, pt.price_inr), 0.05
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

-- ─────────────────────────────────────────────────────────── cost savers
-- Same ElevenLabs prompt + length → reuse the MP3 instead of paying again.
create table public.song_cache (
  hash       text primary key,
  audio_path text not null,               -- bucket gift-media
  created_at timestamptz not null default now()
);
alter table public.song_cache enable row level security;

-- Identical render request (same photos, song, template version) is never sent to JSON2Video twice.
alter table public.render_jobs add column input_hash text;
create index render_jobs_hash_idx on public.render_jobs (gift_id, kind, input_hash);

-- ─────────────────────────────────────────────────────────── storage: audio for template songs
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp',
                                  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/aac']
 where id = 'template-media';

-- ─────────────────────────────────────────────────────────── API key list in the admin
delete from public.api_providers where provider in ('gemini', 'loudly');
insert into public.api_providers (provider, label, env_var) values
  ('elevenlabs', 'ElevenLabs (AI songs)', 'ELEVENLABS_API_KEY')
on conflict (provider) do nothing;
