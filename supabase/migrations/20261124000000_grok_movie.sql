-- Geetzy — Grok movie templates (2026-11-24)
-- Admin writes a design brief, xAI Grok turns it into a JSON "movie template" (once per template, never per gift).
-- The JSON says which photo / text / audio goes where; JSON2Video renders it for every gift.

alter table public.templates
  add column movie_prompt text not null default '',          -- the admin's design brief
  add column movie_json   jsonb,                              -- the movie template (markers like {{photo_1}}); null = built-in design
  add column movie_source text check (movie_source in ('grok', 'manual')),
  add column movie_status text not null default 'none' check (movie_status in ('none', 'queued', 'running', 'ready', 'error')),
  add column movie_error  text,
  add column movie_hash   text;                               -- sha256(brief + settings + model): same hash = no new Grok call

-- cost dashboard: one row per Grok call
alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check (kind in ('lyrics', 'song', 'image', 'movie'));

insert into public.api_providers (provider, label, env_var) values
  ('xai', 'xAI Grok (video templates)', 'XAI_API_KEY')
on conflict (provider) do nothing;

-- A template with its own movie JSON can only go live when that JSON is validated and ready.
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
  return new;
end $$;

-- DB → backend: also start the Grok job
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
  return new;
end $$;
drop trigger if exists templates_dispatch on public.templates;
create trigger templates_dispatch after update of art_status, preview_status, movie_status on public.templates
  for each row execute function public.dispatch_template_job();
