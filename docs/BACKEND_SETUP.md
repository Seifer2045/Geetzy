# Backend setup — Vercel + Supabase + Gemini (Lyria) + JSON2Video

## How it works
```
Phone app ──(Supabase login token)──► FastAPI on Vercel ──► Supabase Postgres + Storage
   │  uploads photos / own song                │
   └──────────► Supabase Storage (gift-uploads) │
                                                ├─► Gemini text  → lyrics
                                                ├─► Lyria 3 clip → 30 s sung song (MP3)
                                                └─► JSON2Video   → 15 s vertical video
```
Vercel can't keep Python running after it replies, so **Supabase starts every step**:
1. New row in `gifts` → database trigger → `POST /internal/gifts/{id}/run`. This writes the lyrics if needed, makes the song (~30–60 s), and starts the render.
2. JSON2Video finishes → `POST /webhooks/json2video` → the video is copied to Storage → status `preview_ready`.
3. Every minute `pg_cron` → `POST /internal/sweep`. It retries stuck gifts, checks renders whose webhook never came, and starts missing HD renders.
4. "Pay" → `POST /payments/verify` → status `paid` → HD render (no watermark) → `hd_path`.

Code: `backend/app/` (`main.py` routes, `pipeline.py` steps, `ai/gemini.py`, `video/json2video.py`).
Database: `supabase/migrations/20261118000000_init.sql` + `supabase/seed.sql`.

## Cost per gift (Nov 2026)
| Step | Cost |
|---|---|
| Lyrics (Gemini Flash) | ~free |
| Song (Lyria 3 clip) | ~$0.04, **no free tier** |
| Preview render (15 s) | 15 JSON2Video credits |
| HD render (15 s, after payment) | 15 credits |

JSON2Video free plan = 600 credits once, **with a JSON2Video watermark, and for evaluation only**. Buy a paid plan before launch.

---

## 1. Google Gemini: turn on billing (needed for Lyria)
Lyria returns "limit: 0 requests per day on Free Tier" until billing is on.
https://aistudio.google.com → API keys → your key's project → **Set up billing**.
The key goes in `backend/.env` as `GEMINI_API_KEY` (already done).

## 2. Supabase: secret key + database
1. Supabase → **Project Settings → API Keys** → copy the **Secret key** (`sb_secret_…`) → paste it into `backend/.env` as `SUPABASE_SECRET_KEY`.
   Never put this key in the app.
2. Supabase → **SQL Editor** → New query:
   - Paste all of `supabase/migrations/20261118000000_init.sql` → **Run**.
   - Paste all of `supabase/seed.sql` → **Run**.
   - (Or with the CLI: `npx supabase login`, then `npx supabase link --project-ref lgzvwklfcnlnbpgpzozq`, then `npx supabase db push`.)
3. Check: **Table Editor** shows `templates` (9 rows) and `price_tiers` (4 rows). **Storage** shows buckets `gift-uploads` and `gift-media`.
   If the migration fails on `pg_cron` or `pg_net`: Database → Extensions → enable both, then run it again.

## 3. Vercel: deploy the backend
Uses `npx vercel` (no global install). Run in PowerShell:
```powershell
cd D:\TestApp\backend
npx vercel login                # once; opens the browser
npx vercel link                 # new project, e.g. geetzy-api; root = this folder
powershell -ExecutionPolicy Bypass -File .\scripts\push-env.ps1   # copies backend/.env values to Vercel
npx vercel --prod               # deploy; prints the URL, e.g. https://geetzy-api.vercel.app
```
- Vercel loads FastAPI from `index.py` (it just imports `app/main.py`) and installs `requirements.txt`. `vercel.json` gives it 300 s.
- `.vercelignore` keeps `.env`, `.venv` and tests from being uploaded. Keys come only from Vercel env vars.
- `PUBLIC_BASE_URL` can stay empty: the app uses Vercel's production URL for the JSON2Video webhook.
- Check: open `https://<your-url>/health` → `{"ok":true}`, and `/templates` → the 9 templates.
- If something fails: Vercel → project → **Deployments → Build Logs**, or **Logs** for runtime errors.
- Changed a key later? Edit `backend/.env`, run `push-env.ps1` again, then `npx vercel --prod`.

## 4. Supabase Vault: let the database call the backend
SQL Editor, using your Vercel URL and the `INTERNAL_SECRET` from `backend/.env`:
```sql
select vault.create_secret('https://geetzy-api.vercel.app', 'backend_url');
select vault.create_secret('<INTERNAL_SECRET from backend/.env>', 'internal_secret');
```
To change one later: `select vault.update_secret((select id from vault.secrets where name = 'backend_url'), 'https://new-url');`
Check after a minute: `select * from cron.job_run_details order by start_time desc limit 5;` should show `succeeded`.

## 5. App: use the real backend
`mobile/.env`:
```
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=https://geetzy-api.vercel.app
```
New native modules were added (`expo-video`, `expo-image-manipulator`), so rebuild once:
```powershell
cd D:\TestApp\mobile
npx expo run:android
```

## 6. Test end to end
1. Sign in with Google → pick a template → add 3 photos → names.
2. Song screen: lyrics appear (from Gemini). Try V2/V3 and ↻.
3. Use this song → "Uploading photos…" → Making screen.
4. In Supabase, check:
   - `gifts` status goes `queued → writing_lyrics → composing → rendering → preview_ready`.
   - `gift-media/<user>/<gift>/` has `song.mp3` and `preview.mp4`.
5. The preview plays with "GEETZY · PREVIEW" on it. Pay (fake) → "Making your HD video…" → HD plays.
6. If a gift fails: the `gifts.error` and `render_jobs.error` columns say why. Vercel → project → **Logs** shows details.

## Local backend (optional)
```powershell
cd D:\TestApp\backend
.venv\Scripts\activate
python -m pip install -r requirements-dev.txt
python -m pytest                         # 16 tests, no network
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # "python -m": Windows blocks uvicorn.exe
```
Locally, webhooks and the database trigger can't reach your PC, so do full tests on the Vercel URL.

## Known limits / next
- **Payments:** `ALLOW_FAKE_PAYMENTS=true` makes "Pay" free. Real Google Play Billing verification is still TODO (`/payments/verify`).
- **Own songs:** the duration is still assumed to be 180 s, so the trim slider can go past the real end.
- **Sharing:** sends a text message only, not the video file (next: download + `expo-sharing`).
- **Before launch:** buy a paid JSON2Video plan (no watermark, commercial use) and rotate the Gemini and JSON2Video keys (they were shared in chat).
