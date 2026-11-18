-- Geetzy — initial schema
-- Data flow: app → FastAPI on Vercel (secret key) → these tables. The app never reads tables directly,
-- so RLS is ON everywhere with (almost) no client policies. Only Storage uploads go straight from the app.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ─────────────────────────────────────────────────────────── enums (mirror mobile/src/api/types.ts)
create type public.occasion        as enum ('birthday', 'anniversary', 'apology', 'festival');
create type public.template_style  as enum ('bollywood', 'retro', 'genz');
create type public.gift_status     as enum ('queued', 'writing_lyrics', 'composing', 'rendering', 'preview_ready', 'paid', 'failed');
create type public.song_source     as enum ('ai', 'upload');
create type public.song_mood       as enum ('happy', 'filmy', 'romantic', 'party');
create type public.song_singer     as enum ('female', 'male', 'duet');
create type public.render_kind     as enum ('preview', 'hd');
create type public.render_status   as enum ('pending', 'running', 'done', 'error');
create type public.payment_status  as enum ('pending', 'verified', 'refunded', 'failed');
create type public.report_status   as enum ('open', 'actioned', 'dismissed');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────── profiles (1:1 with auth.users)
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  email            text,
  phone            text,
  avatar_url       text,
  age_confirmed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.phone,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- users who signed in before this migration
insert into public.profiles (id, full_name, email, phone, avatar_url)
select id,
       coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
       email, phone, raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────── pricing + templates
create table public.price_tiers (
  id              text primary key,                 -- tier_29 / tier_49 / tier_99
  price_inr       integer not null check (price_inr > 0),
  play_product_id text not null unique,             -- Google Play consumable product id
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.templates (
  id                 text primary key,              -- e.g. TPL-BD-0142 (shown to users)
  name               text not null,
  occasion           public.occasion not null,
  style              public.template_style not null,
  description        text not null default '',
  tags               text[] not null default '{}',
  color_from         text not null check (color_from ~ '^#[0-9A-Fa-f]{6}$'),
  color_to           text not null check (color_to ~ '^#[0-9A-Fa-f]{6}$'),
  price_tier_id      text not null references public.price_tiers (id),
  original_price_inr integer check (original_price_inr > 0),
  duration_sec       integer not null default 15 check (duration_sec between 5 and 60),
  photos_min         integer not null default 3 check (photos_min >= 1),
  photos_max         integer not null default 5 check (photos_max <= 10),
  preview_url        text,
  made_count         integer not null default 0,
  trending           boolean not null default false,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  render_config      jsonb not null default '{}'::jsonb,  -- fonts / transition / text style for the video
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (photos_min <= photos_max)
);
create index templates_active_idx on public.templates (is_active, occasion, sort_order);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

create or replace function public.increment_made_count(p_template_id text) returns void
language sql as $$
  update public.templates set made_count = made_count + 1 where id = p_template_id;
$$;

-- ─────────────────────────────────────────────────────────── gifts (one song video)
create sequence public.gift_code_seq start 2001;

create table public.gifts (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default ('GFT-' || nextval('public.gift_code_seq')),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  template_id    text not null references public.templates (id),
  occasion       public.occasion not null,
  recipient_name text not null check (char_length(recipient_name) between 1 and 20),
  sender_name    text not null check (char_length(sender_name) between 1 and 20),
  fun_fact       text not null default '' check (char_length(fun_fact) <= 120),
  status         public.gift_status not null default 'queued',
  progress       real not null default 0 check (progress between 0 and 1),
  price_inr      integer not null,                 -- price at creation time
  attempts       integer not null default 0,
  error          text,
  preview_path   text,                             -- gift-media bucket
  hd_path        text,                             -- gift-media bucket
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index gifts_user_idx on public.gifts (user_id, created_at desc) where deleted_at is null;
create index gifts_status_idx on public.gifts (status, updated_at);
create trigger gifts_updated_at before update on public.gifts
  for each row execute function public.set_updated_at();

create table public.gift_photos (
  id           uuid primary key default gen_random_uuid(),
  gift_id      uuid not null references public.gifts (id) on delete cascade,
  storage_path text not null,                      -- gift-uploads bucket: {user_id}/...
  position     smallint not null check (position between 0 and 9),
  created_at   timestamptz not null default now(),
  unique (gift_id, position)
);

create table public.gift_songs (
  gift_id             uuid primary key references public.gifts (id) on delete cascade,
  source              public.song_source not null,
  mood                public.song_mood,
  singer              public.song_singer,
  version             smallint,
  title               text,
  lyrics              text,
  upload_path         text,                        -- gift-uploads bucket (own song)
  upload_file_name    text,
  upload_duration_sec real,
  trim_start_sec      real not null default 0 check (trim_start_sec >= 0),
  fade                boolean not null default true,
  audio_path          text,                        -- gift-media bucket (Lyria output)
  model               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (
    (source = 'ai' and mood is not null and singer is not null)
    or (source = 'upload' and upload_path is not null)
  )
);
create trigger gift_songs_updated_at before update on public.gift_songs
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────── rendering, payments, usage, reports
create table public.render_jobs (
  id                  uuid primary key default gen_random_uuid(),
  gift_id             uuid not null references public.gifts (id) on delete cascade,
  kind                public.render_kind not null,
  provider            text not null default 'json2video',
  provider_project_id text unique,
  status              public.render_status not null default 'pending',
  error               text,
  created_at          timestamptz not null default now(),
  finished_at         timestamptz
);
create index render_jobs_status_idx on public.render_jobs (status, created_at);
create index render_jobs_gift_idx on public.render_jobs (gift_id, kind);

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  gift_id        uuid not null references public.gifts (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  provider       text not null default 'google_play',   -- 'fake' while testing
  product_id     text,
  purchase_token text unique,
  order_id       text,
  amount_inr     integer not null,
  status         public.payment_status not null default 'pending',
  raw            jsonb,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index payments_gift_idx on public.payments (gift_id);

create table public.ai_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.profiles (id) on delete cascade,
  gift_id      uuid references public.gifts (id) on delete set null,
  kind         text not null check (kind in ('lyrics', 'song')),
  model        text not null,
  est_cost_usd numeric(10, 4) not null default 0,
  created_at   timestamptz not null default now()
);
create index ai_requests_user_idx on public.ai_requests (user_id, kind, created_at desc);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  gift_id     uuid not null references public.gifts (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason      text not null,
  details     text,
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────── atomic create (gift + photos + song)
-- One transaction, so the background job (fired after commit) always sees photos and song.
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
  select * into t from public.templates where id = p_template_id and is_active;
  if not found then
    raise exception 'template_not_found';
  end if;
  if coalesce(array_length(p_photo_paths, 1), 0) not between t.photos_min and t.photos_max then
    raise exception 'photo_count';
  end if;

  insert into public.gifts (user_id, template_id, occasion, recipient_name, sender_name, fun_fact, price_inr, progress)
  select p_user_id, t.id, t.occasion, p_recipient_name, p_sender_name, coalesce(p_fun_fact, ''), pt.price_inr, 0.05
  from public.price_tiers pt where pt.id = t.price_tier_id
  returning * into g;

  insert into public.gift_photos (gift_id, storage_path, position)
  select g.id, path, (ord - 1)::smallint
  from unnest(p_photo_paths) with ordinality as u(path, ord);

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

  return g;
end $$;
revoke execute on function public.create_gift from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────── background work: DB → backend
-- Vault secrets (set once after deploy, see docs/BACKEND_SETUP.md):
--   backend_url      e.g. https://geetzy-api.vercel.app
--   internal_secret  same value as INTERNAL_SECRET on Vercel
create or replace function public.call_backend(p_path text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'backend_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'internal_secret';
  if v_url is null or v_secret is null then
    return null;  -- not configured yet
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || p_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    timeout_milliseconds := 300000
  );
end $$;
revoke execute on function public.call_backend from public, anon, authenticated;

create or replace function public.dispatch_gift() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.call_backend('/internal/gifts/' || new.id || '/run');
  return new;
end $$;
create trigger gifts_dispatch after insert on public.gifts
  for each row execute function public.dispatch_gift();

-- Every minute: retry stuck gifts, poll renders whose webhook never came, start missing HD renders.
select cron.schedule('geetzy-sweep', '* * * * *', $$ select public.call_backend('/internal/sweep') $$);

-- ─────────────────────────────────────────────────────────── row level security
alter table public.profiles    enable row level security;
alter table public.price_tiers enable row level security;
alter table public.templates   enable row level security;
alter table public.gifts       enable row level security;
alter table public.gift_photos enable row level security;
alter table public.gift_songs  enable row level security;
alter table public.render_jobs enable row level security;
alter table public.payments    enable row level security;
alter table public.ai_requests enable row level security;
alter table public.reports     enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "templates: read active" on public.templates
  for select to anon, authenticated using (is_active);
create policy "price_tiers: read active" on public.price_tiers
  for select to anon, authenticated using (active);

-- ─────────────────────────────────────────────────────────── storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gift-uploads', 'gift-uploads', false, 26214400,  -- 25 MB: photos + own songs, uploaded by the app
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic',
         'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg']),
  ('gift-media', 'gift-media', false, 52428800,      -- 50 MB: Lyria songs + rendered videos, backend only
   array['audio/mpeg', 'video/mp4', 'image/jpeg'])
on conflict (id) do nothing;

create policy "gift-uploads: insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gift-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gift-uploads: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'gift-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gift-uploads: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gift-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
