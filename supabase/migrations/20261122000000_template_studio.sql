-- Geetzy — Template Studio (2026-11-22)
-- Layout presets, AI-made template art with photo slots, separate art / song prompts,
-- per-template song provider, Draft → Publish, auto-rendered previews.
-- Work is started by Supabase (trigger → pg_net → backend), same pattern as gifts.

-- ─────────────────────────────────────────────────────────── layouts (shared by admin + backend)
-- slots: [{x,y,w,h,radius,rotate?}] — fractions of the 1080×1920 (9:16) canvas.
-- radius = fraction of the slot's shorter side (0.5 = circle / pill). rotate = degrees (image templates only).
create table public.layouts (
  id          text primary key,
  name        text not null,
  kind        text not null check (kind in ('video', 'image')),
  slots       jsonb not null check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) between 1 and 10),
  photo_count integer generated always as (jsonb_array_length(slots)) stored,
  sort_order  integer not null default 0
);
alter table public.layouts enable row level security;

insert into public.layouts (id, name, kind, slots, sort_order) values
  -- video: ONE frame, shown once per scene (each scene holds one of the user's photos)
  ('frame-large',  'Large frame',  'video', '[{"x":0.08,"y":0.12,"w":0.84,"h":0.50,"radius":0.06}]', 10),
  ('frame-square', 'Square frame', 'video', '[{"x":0.12,"y":0.14,"w":0.76,"h":0.43,"radius":0.05}]', 20),
  ('frame-round',  'Round frame',  'video', '[{"x":0.14,"y":0.15,"w":0.72,"h":0.405,"radius":0.5}]', 30),
  -- image: all slots are filled at once (single picture or collage)
  ('single',    'Single photo', 'image', '[{"x":0.07,"y":0.07,"w":0.86,"h":0.72,"radius":0.05}]', 10),
  ('duo',       'Duo',          'image', '[{"x":0.07,"y":0.06,"w":0.86,"h":0.37,"radius":0.05},{"x":0.07,"y":0.45,"w":0.86,"h":0.37,"radius":0.05}]', 20),
  ('trio',      'Trio',         'image', '[{"x":0.07,"y":0.06,"w":0.86,"h":0.44,"radius":0.05},{"x":0.07,"y":0.52,"w":0.415,"h":0.30,"radius":0.05},{"x":0.515,"y":0.52,"w":0.415,"h":0.30,"radius":0.05}]', 30),
  ('grid-2x2',  'Grid 2×2',     'image', '[{"x":0.07,"y":0.06,"w":0.415,"h":0.37,"radius":0.05},{"x":0.515,"y":0.06,"w":0.415,"h":0.37,"radius":0.05},{"x":0.07,"y":0.45,"w":0.415,"h":0.37,"radius":0.05},{"x":0.515,"y":0.45,"w":0.415,"h":0.37,"radius":0.05}]', 40),
  ('grid-3x2',  'Grid 3×2',     'image', '[{"x":0.07,"y":0.06,"w":0.27,"h":0.36,"radius":0.05},{"x":0.365,"y":0.06,"w":0.27,"h":0.36,"radius":0.05},{"x":0.66,"y":0.06,"w":0.27,"h":0.36,"radius":0.05},{"x":0.07,"y":0.44,"w":0.27,"h":0.36,"radius":0.05},{"x":0.365,"y":0.44,"w":0.27,"h":0.36,"radius":0.05},{"x":0.66,"y":0.44,"w":0.27,"h":0.36,"radius":0.05}]', 50),
  ('polaroid-3','Polaroids',    'image', '[{"x":0.10,"y":0.07,"w":0.55,"h":0.26,"radius":0.02,"rotate":-6},{"x":0.35,"y":0.30,"w":0.55,"h":0.26,"radius":0.02,"rotate":5},{"x":0.12,"y":0.54,"w":0.55,"h":0.26,"radius":0.02,"rotate":-4}]', 60)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────── templates
alter table public.templates
  add column layout_id      text references public.layouts (id) on delete restrict,
  add column art_prompt     text not null default '',
  add column song_prompt    text not null default '',
  add column song_provider  text check (song_provider in ('lyria', 'loudly')),   -- null = SONG_PROVIDER default
  add column art_path       text,      -- bucket template-media: overlay PNG with transparent photo holes
  add column art_bg_path    text,      -- bucket template-media: the AI background without the frame
  add column art_status     text not null default 'none'  check (art_status     in ('none', 'queued', 'running', 'ready', 'error')),
  add column art_error      text,
  add column preview_status text not null default 'none'  check (preview_status in ('none', 'queued', 'running', 'ready', 'error')),
  add column preview_error  text,
  add column status         text not null default 'draft' check (status in ('draft', 'published'));

-- everything that exists today stays live
update public.templates set status = 'published';
-- the old single prompt becomes the song prompt (videos) or the art prompt (photo templates)
update public.templates set song_prompt = prompt where output_type = 'song_video';
update public.templates set art_prompt  = prompt where output_type = 'image';

-- 9:16 only
update public.templates set orientation = 'vertical' where orientation <> 'vertical';
alter table public.templates add check (orientation = 'vertical');

create index templates_status_idx on public.templates (status, is_active, category_id, sort_order);

-- A studio template (has a layout) can only go live once art and preview are ready.
create or replace function public.templates_publish_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and new.layout_id is not null
     and (new.art_status <> 'ready' or new.preview_status <> 'ready') then
    raise exception 'template_not_ready';
  end if;
  return new;
end $$;
create trigger templates_publish_guard before insert or update on public.templates
  for each row execute function public.templates_publish_guard();

-- ─────────────────────────────────────────────────────────── DB → backend (same pattern as gifts_dispatch)
create or replace function public.dispatch_template_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.art_status = 'queued' and new.art_status is distinct from old.art_status then
    perform public.call_backend('/internal/templates/' || new.id || '/art');
  end if;
  if new.preview_status = 'queued' and new.preview_status is distinct from old.preview_status then
    perform public.call_backend('/internal/templates/' || new.id || '/preview');
  end if;
  return new;
end $$;
create trigger templates_dispatch after update of art_status, preview_status on public.templates
  for each row execute function public.dispatch_template_job();

-- JSON2Video renders for template previews (videos). Photo-template previews are made in-process.
create table public.template_preview_jobs (
  id                  uuid primary key default gen_random_uuid(),
  template_id         text not null references public.templates (id) on delete cascade,
  provider_project_id text unique,
  status              text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  error               text,
  created_at          timestamptz not null default now(),
  finished_at         timestamptz
);
create index template_preview_jobs_status_idx on public.template_preview_jobs (status, created_at);
alter table public.template_preview_jobs enable row level security;
