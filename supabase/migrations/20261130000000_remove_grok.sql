-- Geetzy — Grok (xAI) removed (2026-11-30)
-- Video templates are now JSON2Video JSON (pasted from its Editor, or a starter template). Nothing calls xAI any more.
-- Old columns (movie_prompt, bgvideo_*, bgimage_*) stay so no data is lost; they are simply unused.
-- Needs 20261127000000_bgvideo.sql first. Safe to run whether or not 20261129000000_bgimage.sql was applied.

-- The default video layout is "free" (no decorative frame). Harmless if it already exists.
insert into public.layouts (id, name, kind, slots, sort_order) values
  ('free', 'Free design (no frame)', 'video', '[{"x":0,"y":0,"w":1,"h":1,"radius":0}]', 5)
on conflict (id) do nothing;

-- DB → backend: only the jobs that still exist (art, preview, shared song). No Grok / picture / clip jobs.
create or replace function public.dispatch_template_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.art_status = 'queued' and new.art_status is distinct from old.art_status then
    perform public.call_backend('/internal/templates/' || new.id || '/art');
  end if;
  if new.preview_status = 'queued' and new.preview_status is distinct from old.preview_status then
    perform public.call_backend('/internal/templates/' || new.id || '/preview');
  end if;
  if new.song_status = 'queued' and new.song_status is distinct from old.song_status then
    perform public.call_backend('/internal/templates/' || new.id || '/song');
  end if;
  return new;
end $$;
drop trigger if exists templates_dispatch on public.templates;
create trigger templates_dispatch after update of art_status, preview_status, song_status on public.templates
  for each row execute function public.dispatch_template_job();
revoke execute on function public.dispatch_template_job() from public, anon, authenticated;

-- A template can only go live once its art + preview are ready (and its shared song, if it has one).
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
  return new;
end $$;

-- A saved template (pasted or from a starter) is ready as it is; a leftover "running" status from Grok must not block publishing.
update public.templates set movie_status = 'ready' where movie_json is not null and movie_status in ('queued', 'running', 'error');
update public.templates set movie_status = 'none' where movie_json is null and movie_status in ('queued', 'running');

-- The xAI key is gone from the dashboard.
delete from public.api_providers where provider = 'xai';
