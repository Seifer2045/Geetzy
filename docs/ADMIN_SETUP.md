# Admin dashboard setup

Next.js app in `admin/`, deployed as its **own Vercel project**. It talks to Supabase from the server with the secret key (never in the browser). Plan: `C:\Users\HP\.claude\plans\` (see the session) — decisions are summarised below.

## What it does
| Page | What |
|---|---|
| Overview | users, free-credit holders, videos made, paid, revenue, AI cost, 30-day chart, latest failures (numbers come from the `daily_stats` rollup, cached 60 s) |
| Users | search + filter, 25 per page (keyset pagination). Detail: profile, purchases, videos, AI usage, grants. Grant free videos / unlimited days, block, **permanent delete** (super only) |
| Video templates / Photo templates | **Template builder** (see below), drag-and-drop order inside a category |
| Categories | add, hide, drag-and-drop order. The app reads them from `GET /categories` |
| API keys (super) | per provider: last 4 digits, usage, **Test key**, **Rotate** (tests key → Vercel env var → redeploy) |
| Audit log | every admin action |

## One-time setup
1. **Apply the migration** `supabase/migrations/20261121000000_admin.sql` (Supabase SQL editor, or `supabase db push`).
2. **Make yourself super admin** (SQL editor):
   ```sql
   -- first create the user in Supabase → Authentication → Add user (email + password), then:
   insert into public.admins (user_id, role)
   select id, 'super' from auth.users where email = 'you@example.com';
   ```
   Roles: `super` = everything. `support` = read, grant credits, block, edit templates/categories (no delete user, no API keys).
3. **Env vars** — copy `admin/.env.example` to `admin/.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`.
   For key rotation also `VERCEL_API_TOKEN`, `VERCEL_BACKEND_PROJECT_ID` (and `VERCEL_TEAM_ID` if the project is under a team). Create the token at Vercel → Account → Tokens, scoped to the team; the project id is in the `geetzy-api` project settings.
4. **Run locally**: `cd admin; npm install; npm run dev` → http://localhost:3001
5. **Deploy**: `cd admin; npx vercel link` (new project, e.g. `geetzy-admin`), add the same env vars in Vercel (Production), then `npx vercel --prod`. Keep the admin URL private; consider Vercel password protection too.
6. **Apply the migrations** `20261122000000_template_studio.sql` and `20261123000000_template_builder.sql`, and set `ELEVENLABS_API_KEY` on the backend (Vercel).
7. **Redeploy the backend** (`cd backend; npx vercel --prod`) so it knows the new template fields, `GET /categories`, free credits and blocked users. `pillow` is now in `requirements.txt`.

## Rules to remember
- The backend never shows or stores full API keys; the admin only saves last 4 digits (`api_providers`). Real keys stay in Vercel env vars.
- Free credits: when a user pays on the preview screen, `/payments/verify` first calls `consume_credit` (unlimited → no charge, else −1 credit). A `payments` row with `provider='credit'`, amount 0 is written.
- Blocked users get 403 on `/gifts` and `/payments/verify`.
- Photo templates (`output_type='image'`) are composed with Pillow (photos in the layout's slots on the template background): full-size JPG kept as `hd_path`, small watermarked JPG as the preview. No AI call.
- Deleting a user removes Storage files in both buckets, then `auth.admin.deleteUser`; the DB cascades everything else (including `payments`). Only the user id is kept in the audit log.
- Categories keep `legacy_occasion` so old app builds and `gifts.occasion` keep working. New categories default to `festival` there.
- JSON2Video horizontal layout (text size/position) is a first guess — check a horizontal preview.

## API keys: where they go
| Key | Where | How |
|---|---|---|
| `XAI_API_KEY` (Grok) | **backend only** | local: `backend/.env` · production: Vercel project **geetzy-api** -> Settings -> Environment Variables (Production), or fill `backend/.env` and run `backend\scripts\push-env.ps1`; then redeploy (`cd backend; npx vercel --prod`) |
| `ELEVENLABS_API_KEY` | **backend only** | same as above |
| `XAI_MODEL` (default `grok-4`), `XAI_CALLS_PER_DAY` (default 40) | backend env, optional | change the model if xAI renames it |
| `INTERNAL_SECRET` + `BACKEND_URL` | **admin** (`admin/.env.local` and Vercel project geetzy-admin) | same `INTERNAL_SECRET` as the backend; lets Validate / Save check the design JSON |
Never put these keys in the mobile app or in git. Later you can rotate them from **API keys** in this admin (rows `xai`, `elevenlabs`). Apply `supabase/migrations/20261124000000_grok_movie.sql` too.

## Template builder (`/templates/new?type=song_video&cat=<categoryId>`)
Sections, top to bottom:
1. **Basics** — name, category (decides where the app lists it), description, tags.
2. **Video** — layout (frame), **min / max photos the user can add**, length, style, colours, and the **video text prompt** (line 1 = opening title, line 2 = closing line; placeholders allowed). JSON2Video does not make pictures from prompts, so this prompt is on-screen text only. The video always has exactly as many scenes as photos the user adds.
3. **Song** — who chooses: user (AI or own), AI only, own only, **Template song** (same song for everyone, free) or none. **Audio prompt** goes to ElevenLabs (once per video, cached). Upload a **template song** and drag the 15 s window (the file is stored whole; the renderer skips into it with `seek`).
   **Video design (Grok):** write a brief, press **Generate with Grok** (save the template first), wait a few seconds, then read or edit the JSON and press **Validate**. Same brief + settings = no new Grok call; **New design anyway** forces one. Empty JSON = the built-in design. You can also paste your own JSON (no Grok needed). The JSON is checked again on Save. Photos, names and the song are filled in per video; the design stays.
4. **Background picture** — optional upload. None = free gradient from the two colours.
5. **Price** — standard tier, optional **custom price** (the app shows it; Play bills the nearest tier), strike-through price.
6. **Preview** (bottom) — instant sketch while you type (free). **Save & generate preview** builds the background, then renders the real video (about the video length in JSON2Video credits, plus one ElevenLabs song if the template uses an AI song and has no template song).
Publishing needs a built background and a ready preview. Editing anything the preview depends on sends the template back to Draft.
