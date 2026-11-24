-- Geetzy — template background PICTURE made by Grok (xAI image) + the optional-frame "free" layout (2026-11-29)
-- The admin's video prompt makes ONE background picture per template (admin click only, never per gift). It is stored as the
-- template's own background (art_upload_path), so the art rebuild, the preview and every gift use it unchanged.
-- Needs 20261127000000_bgvideo.sql first (re-creates the dispatch trigger and the publish guard from that version).

alter table public.templates
  add column bgimage_prompt    text not null default '',   -- what the picture shows (Grok suggests it, the admin can edit it)
  add column bgimage_suggested text,                       -- Grok's last suggestion: only an empty / unedited prompt is replaced by a new one
  add column bgimage_status    text not null default 'none' check (bgimage_status in ('none', 'queued', 'running', 'ready', 'error')),
  add column bgimage_error     text,
  add column bgimage_hash      text;                       -- same prompt + settings = no new xAI call

-- Video layout with NO decorative frame: Grok chooses every photo box. First in the picker (sort_order 5) = the default for new templates.
insert into public.layouts (id, name, kind, slots, sort_order) values
  ('free', 'Free design (no frame)', 'video', '[{"x":0,"y":0,"w":1,"h":1,"radius":0}]', 5)
on conflict (id) do nothing;

-- DB → backend: also start the picture job
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
  if new.bgimage_status = 'queued' and new.bgimage_status is distinct from old.bgimage_status then
    perform public.call_backend('/internal/templates/' || new.id || '/bgimage');
  end if;
  return new;
end $$;
drop trigger if exists templates_dispatch on public.templates;
create trigger templates_dispatch after update of art_status, preview_status, movie_status, song_status, bgvideo_status, bgimage_status on public.templates
  for each row execute function public.dispatch_template_job();
revoke execute on function public.dispatch_template_job() from public, anon, authenticated;

-- A template can only go live while no clip or picture is being made for it.
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
  if new.status = 'published' and (new.bgvideo_status in ('queued', 'running') or new.bgimage_status in ('queued', 'running')) then
    raise exception 'template_not_ready';
  end if;
  return new;
end $$;
