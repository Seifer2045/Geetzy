-- Geetzy — admin dashboard schema (2026-11-21)
-- Adds: admins, credits, categories, richer templates, API-provider metadata, audit log,
-- rollup stats, keyset-pagination + search indexes, reorder / credit RPCs.
-- Everything is reached by the admin app (Next.js, server side) with the secret key, so RLS is ON
-- and there are no client policies except "read active categories".

create extension if not exists pg_trgm with schema extensions;

-- ─────────────────────────────────────────────────────────── admins
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('super', 'support')),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- First super admin (run once, replace the email):
--   insert into public.admins (user_id, role)
--   select id, 'super' from auth.users where email = 'you@example.com';

-- ─────────────────────────────────────────────────────────── profiles: credits + block
alter table public.profiles
  add column free_credits    integer not null default 0 check (free_credits >= 0),
  add column unlimited_until timestamptz,
  add column blocked_at      timestamptz;

create index profiles_created_idx   on public.profiles (created_at desc, id desc);
create index profiles_credits_idx   on public.profiles (id) where free_credits > 0;
create index profiles_unlimited_idx on public.profiles (unlimited_until) where unlimited_until is not null;
create index profiles_email_trgm    on public.profiles using gin (email extensions.gin_trgm_ops);
create index profiles_name_trgm     on public.profiles using gin (full_name extensions.gin_trgm_ops);
create index profiles_phone_trgm    on public.profiles using gin (phone extensions.gin_trgm_ops);

create table public.credit_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  admin_id   uuid references auth.users (id) on delete set null,
  kind       text not null check (kind in ('credits', 'unlimited')),
  amount     integer not null check (amount > 0),   -- number of videos, or number of days
  expires_at timestamptz,                            -- for 'unlimited'
  note       text,
  created_at timestamptz not null default now()
);
create index credit_grants_user_idx on public.credit_grants (user_id, created_at desc);
alter table public.credit_grants enable row level security;

-- Atomic: returns 'unlimited' | 'credit' | null (null = user must pay).
create or replace function public.consume_credit(p_user_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_until timestamptz;
  v_left  integer;
begin
  select unlimited_until into v_until from public.profiles where id = p_user_id;
  if v_until is not null and v_until > now() then
    return 'unlimited';
  end if;
  update public.profiles set free_credits = free_credits - 1
   where id = p_user_id and free_credits > 0
  returning free_credits into v_left;
  if found then
    return 'credit';
  end if;
  return null;
end $$;
revoke execute on function public.consume_credit from public, anon, authenticated;

-- Admin grant: atomic update + audit row. p_kind 'credits' → +N videos, 'unlimited' → +N days of unlimited.
create or replace function public.admin_grant(
  p_user_id uuid, p_admin_id uuid, p_kind text, p_amount integer, p_note text
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_until   timestamptz;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'bad_amount';
  end if;
  if p_kind = 'credits' then
    update public.profiles set free_credits = free_credits + p_amount
     where id = p_user_id returning * into v_profile;
  elsif p_kind = 'unlimited' then
    update public.profiles
       set unlimited_until = greatest(coalesce(unlimited_until, now()), now()) + make_interval(days => p_amount)
     where id = p_user_id returning * into v_profile;
    v_until := v_profile.unlimited_until;
  else
    raise exception 'bad_kind';
  end if;
  if not found then
    raise exception 'user_not_found';
  end if;
  insert into public.credit_grants (user_id, admin_id, kind, amount, expires_at, note)
  values (p_user_id, p_admin_id, p_kind, p_amount, v_until, nullif(p_note, ''));
  return v_profile;
end $$;
revoke execute on function public.admin_grant from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────── categories (dynamic, replaces hardcoded occasions)
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name           text not null,
  emoji          text,
  color_from     text not null default '#FF4D8D' check (color_from ~ '^#[0-9A-Fa-f]{6}$'),
  color_to       text not null default '#C04CF0' check (color_to   ~ '^#[0-9A-Fa-f]{6}$'),
  output_type    text not null default 'song_video' check (output_type in ('song_video', 'image')),
  legacy_occasion public.occasion not null default 'festival',  -- keeps old app builds + gifts.occasion working
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index categories_order_idx on public.categories (output_type, is_active, sort_order);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
alter table public.categories enable row level security;
create policy "categories: read active" on public.categories
  for select to anon, authenticated using (is_active);

insert into public.categories (slug, name, emoji, color_from, color_to, legacy_occasion, sort_order, is_active) values
  ('birthday',    'Birthday',    '🎂', '#FF4D8D', '#C2185B', 'birthday',    10, true),
  ('anniversary', 'Anniversary', '💍', '#FF8A5C', '#E0306E', 'anniversary', 20, true),
  ('apology',     'Apology',     '🙏', '#6C8CFF', '#4B2BC8', 'apology',     30, true),
  ('festival',    'Festival',    '🪔', '#FFC857', '#E07A00', 'festival',    40, false)  -- "coming soon" in the app
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────── templates: new admin-managed fields
alter table public.templates
  add column category_id        uuid references public.categories (id) on delete restrict,
  add column orientation        text not null default 'vertical' check (orientation in ('vertical', 'horizontal')),
  add column prompt             text not null default '',
  add column output_type        text not null default 'song_video' check (output_type in ('song_video', 'image')),
  add column song_mode          text not null default 'both' check (song_mode in ('ai', 'upload', 'both', 'none')),
  add column engine             text not null default 'json2video',
  add column preview_video_path text,   -- bucket template-media
  add column thumb_path         text;   -- bucket template-media

update public.templates t set category_id = c.id
from public.categories c where c.slug = t.occasion::text;

alter table public.templates alter column category_id set not null;
alter table public.templates alter column occasion set default 'festival';
alter table public.templates add check (output_type <> 'image' or song_mode = 'none');

-- occasion / output_type always follow the category, so the admin only picks a category
create or replace function public.templates_sync_category() returns trigger
language plpgsql as $$
declare c public.categories;
begin
  select * into c from public.categories where id = new.category_id;
  if found then
    new.occasion    := c.legacy_occasion;
    new.output_type := c.output_type;
    if c.output_type = 'image' then
      new.song_mode := 'none';
    end if;
  end if;
  return new;
end $$;
create trigger templates_sync_category before insert or update on public.templates
  for each row execute function public.templates_sync_category();

drop index if exists public.templates_active_idx;
create index templates_active_idx   on public.templates (is_active, category_id, sort_order);
create index templates_category_idx on public.templates (category_id, sort_order);
create index templates_type_idx     on public.templates (output_type, sort_order);

-- ─────────────────────────────────────────────────────────── AI usage log + provider metadata
alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add check (kind in ('lyrics', 'song', 'image'));
alter table public.ai_requests
  add column provider   text,
  add column ok         boolean not null default true,
  add column latency_ms integer,
  add column error      text;
create index ai_requests_created_idx on public.ai_requests (created_at desc);
create index ai_requests_provider_idx on public.ai_requests (provider, created_at desc);

-- Metadata only. The real keys live in Vercel env vars (rotated through the Vercel API) — never in the DB.
create table public.api_providers (
  provider      text primary key,            -- gemini | loudly | json2video
  label         text not null,
  env_var       text not null,
  last4         text,
  rotated_at    timestamptz,
  rotated_by    uuid references auth.users (id) on delete set null,
  last_check_at timestamptz,
  last_check_ok boolean
);
alter table public.api_providers enable row level security;
insert into public.api_providers (provider, label, env_var) values
  ('gemini',    'Google Gemini (lyrics, Lyria, images)', 'GEMINI_API_KEY'),
  ('loudly',    'Loudly (songs)',                         'LOUDLY_API_KEY'),
  ('json2video','JSON2Video (video render)',              'JSON2VIDEO_API_KEY')
on conflict (provider) do nothing;

-- ─────────────────────────────────────────────────────────── audit log
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,                 -- e.g. user.grant_credits, user.delete, key.rotate, template.update
  target_type text,
  target_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_created_idx on public.admin_audit_log (created_at desc, id desc);
alter table public.admin_audit_log enable row level security;

-- ─────────────────────────────────────────────────────────── keyset-pagination indexes (admin lists)
create index gifts_created_idx    on public.gifts (created_at desc, id desc);
create index payments_created_idx on public.payments (created_at desc, id desc);
create index payments_user_idx    on public.payments (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────── rollup stats (dashboard reads ~30 rows)
create table public.daily_stats (
  day         date primary key,              -- India date
  new_users   integer not null default 0,
  gifts       integer not null default 0,
  paid        integer not null default 0,
  failed      integer not null default 0,
  revenue_inr integer not null default 0,
  ai_cost_usd numeric(12, 4) not null default 0
);
alter table public.daily_stats enable row level security;

create or replace function public.refresh_daily_stats(p_from date) returns void
language sql security definer set search_path = '' as $$
  with
  u as (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n
          from public.profiles where (created_at at time zone 'Asia/Kolkata')::date >= p_from group by 1),
  g as (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n,
               count(*) filter (where status = 'failed') as failed
          from public.gifts where (created_at at time zone 'Asia/Kolkata')::date >= p_from group by 1),
  p as (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n,
               coalesce(sum(amount_inr) filter (where provider <> 'credit'), 0) as rev
          from public.payments where status = 'verified'
           and (created_at at time zone 'Asia/Kolkata')::date >= p_from group by 1),
  a as (select (created_at at time zone 'Asia/Kolkata')::date as day, sum(est_cost_usd) as cost
          from public.ai_requests where (created_at at time zone 'Asia/Kolkata')::date >= p_from group by 1),
  days as (select day from u union select day from g union select day from p union select day from a)
  insert into public.daily_stats (day, new_users, gifts, paid, failed, revenue_inr, ai_cost_usd)
  select d.day, coalesce(u.n, 0), coalesce(g.n, 0), coalesce(p.n, 0), coalesce(g.failed, 0),
         coalesce(p.rev, 0), coalesce(a.cost, 0)
  from days d
  left join u using (day) left join g using (day) left join p using (day) left join a using (day)
  on conflict (day) do update set
    new_users = excluded.new_users, gifts = excluded.gifts, paid = excluded.paid,
    failed = excluded.failed, revenue_inr = excluded.revenue_inr, ai_cost_usd = excluded.ai_cost_usd;
$$;
revoke execute on function public.refresh_daily_stats from public, anon, authenticated;

select public.refresh_daily_stats('2000-01-01');   -- one-time backfill
select cron.schedule('geetzy-daily-stats', '7 * * * *',
  $$ select public.refresh_daily_stats(((now() at time zone 'Asia/Kolkata')::date) - 1) $$);

-- One cheap call for the Overview cards.
create or replace function public.admin_overview() returns jsonb
language sql stable security definer set search_path = '' as $$
  with t as (select (now() at time zone 'Asia/Kolkata')::date as today)
  select jsonb_build_object(
    'users_total',      coalesce(sum(new_users), 0),
    'users_7d',         coalesce(sum(new_users) filter (where day > t.today - 7), 0),
    'gifts_total',      coalesce(sum(gifts), 0),
    'gifts_today',      coalesce(sum(gifts) filter (where day = t.today), 0),
    'gifts_7d',         coalesce(sum(gifts) filter (where day > t.today - 7), 0),
    'gifts_30d',        coalesce(sum(gifts) filter (where day > t.today - 30), 0),
    'paid_total',       coalesce(sum(paid), 0),
    'failed_total',     coalesce(sum(failed), 0),
    'revenue_total',    coalesce(sum(revenue_inr), 0),
    'revenue_30d',      coalesce(sum(revenue_inr) filter (where day > t.today - 30), 0),
    'ai_cost_30d_usd',  coalesce(sum(ai_cost_usd) filter (where day > t.today - 30), 0),
    'credit_holders',   (select count(*) from public.profiles
                          where free_credits > 0 or unlimited_until > now()),
    'in_progress',      (select count(*) from public.gifts
                          where status in ('queued', 'writing_lyrics', 'composing', 'rendering')
                            and deleted_at is null)
  )
  from public.daily_stats, t;
$$;
revoke execute on function public.admin_overview from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────── drag-and-drop ordering (one UPDATE)
create or replace function public.admin_reorder(p_table text, p_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_table = 'categories' then
    update public.categories c set sort_order = u.ord * 10
      from unnest(p_ids) with ordinality as u(id, ord) where c.id::text = u.id;
  elsif p_table = 'templates' then
    update public.templates t set sort_order = u.ord * 10
      from unnest(p_ids) with ordinality as u(id, ord) where t.id = u.id;
  else
    raise exception 'bad_table';
  end if;
end $$;
revoke execute on function public.admin_reorder from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────── create_gift: blocked users, optional song
-- Same signature as before. p_song may be null (image templates / song_mode 'none').
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

-- ─────────────────────────────────────────────────────────── storage: public bucket for template media
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('template-media', 'template-media', true, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- Public read comes from the bucket being public; uploads use signed upload URLs created by the admin server.

-- Photo templates store a full-size PNG and a small JPG preview in gift-media.
update storage.buckets
   set allowed_mime_types = array['audio/mpeg', 'video/mp4', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'gift-media';
