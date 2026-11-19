# CLAUDE.md — project context for Claude Code

Read this first. Full decision history: `docs/SESSION_HANDOFF.md`. Architecture: `docs/ARCHITECTURE.md`. Design tokens/rules: `docs/DESIGN_SYSTEM.md`.

## What we're building
Android app (Expo, TypeScript) for **personalised 15-second AI song videos** as gifts (Birthday, Anniversary, Apology; Festivals later).
User picks a template → adds 3–5 photos + names + a fun fact → AI song (or own uploaded song, trimmed to 15 s) → video is generated on the server → watermarked preview → pays (₹49 typical, price is dynamic per template) → HD download / share to WhatsApp.

- App name: **Geetzy** (decided 2026-11-17; replaced the placeholder "Tarana", which is a Tarana Wireless trademark). Name lives in `mobile/src/config/brand.ts` + `mobile/app.json`; Android package `com.geetzy.app`.
- Users are 18+ (DPDP Act / Play Families policy). Language: Indian English.

## Developer
- Solo developer, Windows, Antigravity IDE, tests on a **physical Android phone over USB** (not emulator).
- Explain things in **simple English**, short and clear.

## Repo layout
```
D:\TestApp
├─ mobile/    Expo app (expo-router, TypeScript)  ← main work
├─ backend/   FastAPI API, deployed to Vercel (data in Supabase)
├─ supabase/  migrations/ (schema, RLS, storage, pg_net/pg_cron) + seed.sql (tiers, templates)
└─ docs/      ARCHITECTURE.md, DESIGN_SYSTEM.md, SESSION_HANDOFF.md, GOOGLE_SIGNIN_SETUP.md, BACKEND_SETUP.md
```

## Commands
```powershell
cd D:\TestApp\mobile
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # first time: installs SDK-matched deps via `npx expo install`
npx expo run:android      # build + install the DEV BUILD on the phone (first time, and after native/app.json changes)
npx expo start            # daily: JS reload into the dev build. Expo Go only works with empty Supabase keys (mock login)
npx tsc --noEmit          # typecheck
npx expo-doctor           # version check
# backend (secrets in backend/.env, never committed)
cd D:\TestApp\backend; .venv\Scripts\activate; python -m pip install -r requirements-dev.txt
python -m pytest                         # offline tests (use python -m: Windows blocks the .exe launchers)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
npx vercel --prod                        # deploy (first: npx vercel login, npx vercel link, scripts\push-env.ps1)
```
Switch app to backend: `mobile/.env` → `EXPO_PUBLIC_USE_MOCK=false`, `EXPO_PUBLIC_API_URL=https://<vercel-url>`. Full steps: `docs/BACKEND_SETUP.md`.

## Status (as of 2026-11-18)
- Installed on **Expo SDK 58** (React 19.3, RN 0.88). `tsc` clean, `expo-doctor` 20/20. Dev build compiles (`app-debug.apk`).
- **Real backend written, not deployed yet** (see `docs/BACKEND_SETUP.md`). Waiting on: Supabase secret key + run migration/seed, Google billing for Lyria, Vercel login/deploy, Vault secrets. Verified: Gemini lyrics work, JSON2Video render works (15 s, 540×960, ~23 s), backend `pytest` 16/16.
- Done: animated splash, Login, Home, Explore, Library, Profile, create flow: `templates → template/[id] (name, ID, dynamic price) → details (photos) → song (AI | upload) → trim → making → preview & pay`.
- **Google sign-in = Supabase Auth** (native `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken`). Code: `src/auth/`, `src/store/auth.ts`. Setup steps: `docs/GOOGLE_SIGNIN_SETUP.md`. Real only when the 3 `EXPO_PUBLIC_SUPABASE_*`/`GOOGLE_WEB_CLIENT_ID` keys are set in `mobile/.env`; otherwise mock. Needs the dev build (not Expo Go).
- Mocked: phone OTP (Supabase phone auth needs an SMS provider), payments (`ALLOW_FAKE_PAYMENTS=true` on the server), uploaded song duration (assumed 180 s), sharing (text only, not the video file). Mock mode (`EXPO_PUBLIC_USE_MOCK=true`) still works fully offline.
- SDK 58 notes: custom tab bar gets `{ state, emitter, navigateToTab }` (types from `expo-router/tabs`), not `navigation`. TextInput refs use `TextInputInstance`.
- Windows build: "Filename longer than 260 characters" comes from ninja 1.10 in CMake 3.22.1. Fix = SDK CMake 3.31.6 (ninja 1.12.1) via `mobile/android/local.properties` → `cmake.dir=C\:\\Android\\Sdk\\cmake\\3.31.6`. That file is not committed and is lost on `expo prebuild --clean`; re-add it.

## Stack & decisions (don't change without asking)
- expo-router, React Query (server state), zustand (`store/auth.ts` persisted, `store/createFlow.ts` draft), StyleSheet + tokens (no NativeWind), Reanimated, react-native-svg, lottie-react-native, expo-linear-gradient, expo-blur, expo-image, expo-image-picker, expo-document-picker.
- API layer: screens only call `src/api/hooks.ts` → `src/api/client.ts` (mock or http). Contract: `src/api/types.ts` ↔ `backend/app/schemas.py` (camelCase on the wire). Keep both in sync.
- **Backend = Python FastAPI on Vercel** (decided 2026-11-18; replaces DigitalOcean + Redis + FFmpeg worker). **DB + files = Supabase** Postgres + Storage (`gift-uploads` written by the app under `{userId}/`, `gift-media` written by the backend). RLS on everywhere; the app reads data only through the API (backend uses the secret key).
- No background work on Vercel Python: **Supabase starts every step** (insert trigger → `pg_net` → `/internal/gifts/{id}/run`; `pg_cron` every minute → `/internal/sweep`; JSON2Video webhook → `/webhooks/json2video`). Pipeline steps must stay idempotent. URL + secret live in Supabase Vault.
- **Lyrics = Gemini text** (`gemini-flash-latest`, fallback `gemini-flash-lite-latest`). **Song = Lyria 3** (`lyria-3-clip-preview`, 30 s MP3, Interactions API), made **once after "Use this song"** (song screen shows lyrics only). Never MusicGen (CC-BY-NC).
  **Temporary (2026-11-19): Loudly** (`backend/app/ai/loudly.py`, instrumental only, lyrics shown as text) is the default via `SONG_PROVIDER=loudly` + `LOUDLY_API_KEY`; set `SONG_PROVIDER=lyria` to go back. Loudly endpoint/fields written from memory (docs are login-only) — verify on first real call.
- **Video = JSON2Video** (movie JSON built in `backend/app/video/json2video.py` from `templates.render_config`; 9:16, preview 540×960 with "GEETZY · PREVIEW" watermark, HD 1080×1920 only **after payment**). Own song is trimmed by the audio `seek` property, no FFmpeg. Video is never rendered on the phone.
- Payments: Google Play Billing consumables mapped to **price tiers** (₹29/₹39/₹49/₹99, table `price_tiers`); template points to a tier.

## UI rules (Figma "v2 – Premium")
- Figma file: `https://www.figma.com/design/Ks2310t6X3D4iBAtzyUD44` (page "v2 – Premium"). Figma MCP is on the **Starter plan (tiny monthly call limit)** — don't burn calls on reads; the design is already encoded in code.
- Never hardcode colors/spacing/fonts in screens → use `src/theme/tokens.ts` (`colors`, `gradients`, `spacing`, `radius`, `typography`, `motion`, `shadows`).
- Dark theme: bg `#0A0A0F`, glass cards `rgba(255,255,255,0.06)` + 1px `rgba(255,255,255,0.09)` border, brand gradient `#FF4D8D → #C04CF0 → #7C5CFF`, gold `#FFC857` for prices. Font: Inter (400–800).
- Reuse components from `src/components` (Button primary/glass/light, Chip, Segmented, TopBar with step pills, Input, TemplateCard, StickyFooter, GlassCard, TabBar, Waveform, Lottie, IconSwap, Icon set).
- Bottom tabs: Home · Explore · (+ Create) · Library · Profile. "Library" = user's generated videos/images/drafts.
- Motion (ui-motion rules): enter = opacity + translateY 12→0, 300 ms, stagger ~100 ms (`enterUp(delay)`); exit 150 ms −12 px; press scale 0.97; icon swaps scale 0.25→1 with non-bouncy spring; no overshoot; respect Reduce Motion.
- Lottie files in `mobile/assets/lottie` (confetti-burst, equalizer, music-notes) are simple placeholders; swap for LottieFiles exports with the same names.

## Next steps (in order)
1. Finish `docs/BACKEND_SETUP.md` (secret key, migration, Lyria billing, Vercel deploy, Vault), switch `mobile/.env` to the real API, `npx expo run:android`, test end to end.
2. Google Play Billing tiers + real purchase-token check in `/payments/verify` (then set `ALLOW_FAKE_PAYMENTS=false`).
3. Share/save the real video file (download + `expo-sharing` / media library); real duration of uploaded songs.
4. Phone OTP via Supabase (SMS provider, e.g. MSG91/Twilio).
5. Push notifications when video is ready; report/takedown flow (`reports` table exists). Paid JSON2Video plan before launch.
