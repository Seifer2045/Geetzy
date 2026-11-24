-- Geetzy — template background VIDEO made by Grok Imagine (2026-11-27)
-- The admin writes a prompt, xAI makes ONE silent 9:16 clip per template with a flat green PHOTO WINDOW.
-- JSON2Video puts the user's photo under the clip and keys the green out, so the photo shows in the window.
-- Needs 20261126000000_song_spec.sql first (create_gift below extends it).

alter table public.templates
  add column bgvideo_prompt           text not null default '',
  add column bgvideo_status           text not null default 'none' check (bgvideo_status in ('none', 'queued', 'running', 'ready', 'error')),
  add column bgvideo_error            text,
  add column bgvideo_request_id       text,         -- xAI request id while the clip is being made
  add column bgvideo_started_at       timestamptz,
  add column bgvideo_hash             text,         -- same prompt + settings = no new xAI call
  add column bgvideo_candidate_path   text,         -- bucket template-media: made, waiting for the admin's approval
  add column bgvideo_candidate_window jsonb,        -- [x, y, w, h] fractions of the green window found in the candidate
  add column bgvideo_candidate_note   text,         -- plain-English result of the window check
  add column bgvideo_path             text,         -- approved clip, used in every video
  add column bgvideo_window           jsonb,        -- [x, y, w, h] fractions
  add column bgvideo_mode             text check (bgvideo_mode in ('window', 'overlay'));

-- cost dashboard: one row per xAI video call
alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check (kind in ('lyrics', 'song', 'image', 'movie', 'video'));

-- DB → backend: also start the video job
create or replace function public.dispatch_template_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.art_status = 'queued' and new.art_status is distinct from old.art_status then
    perform public.call_backend('/internal/templates/' || new.id || '/art');
  end if;
  if new.preview_status = 'queued' and new.preview_status is distinct from old.preview_status then
    perform public.call_backend('/internal/templates/' || new.id || '/preview');
  end if;
  if new.movie_status = 'queued' and new.movie_status is distinct from old.movie_status then
    perform public.call_backend('/internal/templates/' || new.id || '/movie');
  end if;
  if new.song_status = 'queued' and new.song_status is distinct from old.song_status then
    perform public.call_backend('/internal/templates/' || new.id || '/song');
  end if;
  if new.bgvideo_status = 'queued' and new.bgvideo_status is distinct from old.bgvideo_status then
    perform public.call_backend('/internal/templates/' || new.id || '/bgvideo');
  end if;
  return new;
end $$;
drop trigger if exists templates_dispatch on public.templates;
create trigger templates_dispatch after update of art_status, preview_status, movie_status, song_status, bgvideo_status on public.templates
  for each row execute function public.dispatch_template_job();
revoke execute on function public.dispatch_template_job() from public, anon, authenticated;

-- A template can only go live while no clip is being made for it.
create or replace function public.templates_publish_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and new.layout_id is not null
     and (new.art_status <> 'ready' or new.preview_status <> 'ready') then
    raise exception 'template_not_ready';
  end if;
  if new.status = 'published' and new.movie_json is not null and new.movie_status <> 'ready' then
    raise exception 'template_not_ready';
  end if;
  if new.status = 'published' and new.song_json is not null and new.song_status <> 'ready' then
    raise exception 'template_not_ready';
  end if;
  if new.status = 'published' and new.bgvideo_status in ('queued', 'running') then
    raise exception 'template_not_ready';
  end if;
  return new;
end $$;

-- Freeze the clip on each gift too (HD must match the preview, and a later template change must not change a gift).
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
