# Architecture — Geetzy

AI song & video gifting app. A user picks an occasion template, adds 3–5 photos and a name,
gets a 15-second song video (AI song or their own trimmed song), pays per video, and shares it.

> App name: **Geetzy** (replaced the placeholder "Tarana" on 2026-11-17).
> Change it in one place: `mobile/src/config/brand.ts` (+ `app.json` name/slug).

---

## 1. Requirements

**Functional**
- Browse templates by occasion (Birthday, Anniversary, Apology, Festivals) and style (Bollywood, Retro, Gen Z)
- Template preview with name, ID and **dynamic price** from the API
- Upload 3–5 photos, enter recipient name / sender / fun fact
- Song: AI song (mood, singer, 3 versions, editable lyrics) **or** upload own song + trim to 15 s
- Background generation with progress, push when ready
- Watermarked preview → pay (Google Play Billing) → HD download / share
- Library of everything the user generated (videos, images, drafts)
- Profile, settings, logout, delete account

**Non-functional**
- Android first (Expo, TypeScript), iOS later from the same code
- Video ready in ~1–2 min; app usable while waiting
- Cost per video ≤ ₹2 at launch (price ₹29–₹99)
- Users 18+ (DPDP Act / Play Families policy)

**Constraints**
- Solo developer, ~8 weeks to v1
- Backend: Python FastAPI on DigitalOcean; AI models from Hugging Face

---

## 2. High-level design

```
┌────────────── Expo app (TypeScript) ──────────────┐
│ expo-router screens → hooks (React Query)          │
│        → src/api/client.ts ──┬── mock (now)        │
│                              └── HTTP (later)      │
│ zustand: auth, create-flow draft                   │
└───────────────┬───────────────────────────────────┘
                │ HTTPS (JSON) + presigned uploads
┌───────────────▼───────────────┐      ┌────────────────────┐
│ FastAPI (CPU Droplet, BLR)    │─────▶│ Postgres (Supabase)│
│  /templates /gifts /payments  │      └────────────────────┘
│  /uploads (presigned URLs)    │      ┌────────────────────┐
└───────────────┬───────────────┘      │ R2 / DO Spaces     │
                │ enqueue job          │ photos, songs, mp4 │
        ┌───────▼────────┐             └─────────▲──────────┘
        │ Redis queue    │                       │
        └───────┬────────┘                       │
        ┌───────▼──────────────────────────────┐ │
        │ Worker (Python)                      │ │
        │ 1 lyrics (template text / LLM)       │ │
        │ 2 song: ACE-Step 1.5 (MIT)           │─┘
        │    hosted API → own GPU Droplet later│
        │ 3 trim upload: FFmpeg -ss -t + fades │
        │ 4 render: FFmpeg template JSON 9:16  │
        │ 5 preview (watermark) + HD           │
        └──────────────────────────────────────┘
```

### Gift job states
`queued → writing_lyrics → composing → rendering → preview_ready → paid` (or `failed`)

The app polls `GET /gifts/{id}` every ~2 s while on the Making screen and gets a push
notification (expo-notifications) when the user leaves.

### API contract (mirrors `mobile/src/api/types.ts`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/templates?occasion=&style=&q=` | list templates (price is dynamic) |
| GET | `/templates/{id}` | template detail |
| POST | `/uploads/presign` | presigned URLs for photos / song |
| POST | `/songs/ai` | generate AI song versions for a draft |
| POST | `/gifts` | create gift job (template, photos, names, song) |
| GET | `/gifts/{id}` | status + progress + preview URL |
| POST | `/payments/verify` | verify Play purchase token, unlock HD |
| GET | `/library` | user's videos / images / drafts |

---

## 3. ADRs

### ADR-001: Two folders (`mobile/`, `backend/`) instead of a monorepo
**Status:** Accepted · **Date:** 2026-11-17

**Context:** Solo developer, two languages (TypeScript + Python), little shared code.

| | Two folders | Turborepo monorepo |
|---|---|---|
| Complexity | Low | Medium |
| Shared TS code | none needed yet | yes |
| Tooling | npm + pip | turbo + workspaces + pip |

**Decision:** Two folders. The API contract lives in `mobile/src/api/types.ts` and
`backend/app/schemas.py`; keep them in sync by hand (or generate TS from FastAPI's OpenAPI later).

**Revisit when:** a web app or admin panel needs the same TS types.

### ADR-002: Mock-first data layer with a single switch
**Status:** Accepted

**Decision:** All screens talk to `src/api/client.ts`. `EXPO_PUBLIC_USE_MOCK=true` (default)
serves `src/api/mock.ts` with realistic delays and a simulated job timeline.
Set it to `false` and `EXPO_PUBLIC_API_URL` to hit FastAPI. Screens never change.

### ADR-003: Server-side rendering of video
**Status:** Accepted

**Context:** ffmpeg-kit for React Native was retired; phone rendering is slow and drains battery.
**Decision:** Phone uploads photos and sends trim start/end only. FFmpeg runs in the worker.

### ADR-004: State management
**Decision:** React Query for server state (templates, gifts, library) + zustand for
client state (auth session, create-flow draft). No Redux.

### ADR-005: Styling
**Decision:** `StyleSheet` + typed theme tokens (`src/theme`). Motion with Reanimated,
illustrations with react-native-svg, celebration/ambient loops with Lottie.

### ADR-006: Payments
**Decision:** Google Play Billing (one-time consumables) mapped to **price tiers**
(₹29 / ₹49 / ₹99). Each template points to a tier, so prices stay dynamic without
creating a Play product per template. Server verifies the purchase token.

### ADR-009: Grok writes the movie template JSON, once per template (2026-11-24)
**Decision:** the admin writes a design brief; **xAI Grok** returns a JSON *movie template* (`templates.movie_json`) that says which photo, text and sound goes where. JSON2Video renders that JSON for every gift. Grok runs only on the admin's "Generate with Grok" click (job `/internal/templates/{id}/movie`, started by the DB trigger like art/preview), never per gift.
**Format** (`backend/app/video/movie_template.py`): only `image`/`text`/`audio`; pictures and sound only as markers (`{{photo_1}}`, `{{audio}}`, `{{art}}`, `{{background}}`), text markers `{{name}} {{sender}} {{fun_fact}} {{occasion}}`; geometry as fractions of the canvas so one JSON renders at 540x960 and 1080x1920; the backend alone sets size, quality, webhook and export. A scene whose photo number is above the user's photo count is dropped and the rest stretched to keep the length.
**Safety:** Grok output is untrusted: strict validator (whitelists, no links, size limits), checked again on Save, and again when rendering; if a stored JSON ever fails, the gift uses the built-in design.
**Cost:** `movie_hash` (same brief + settings = no call), max 2 Grok calls per click (1 retry that shows Grok its errors), daily cap `XAI_CALLS_PER_DAY`, every call logged in `ai_requests` (kind `movie`).
**Layers:** `providers/xai.py` -> `services/movie_design.py` (generate) · `services/render_body.py` (template JSON or built-in) -> `video/json2video.py`.

### ADR-008: ElevenLabs songs, no Gemini (2026-11-23)
**Decision:** Gemini (lyrics, Lyria, AI art) and Loudly are removed. AI songs = **ElevenLabs Music**, one call per gift after "Use this song", exactly the video length (15 s), 64 kbps MP3. The admin's *audio prompt* (placeholders `{name} {sender} {fun_fact} {occasion}`) is sent as is; there is no lyrics step. Template art = admin upload, or a free gradient in the template colours (Pillow, no AI).
**Cost rules:** `song_cache` (same prompt = same MP3, never paid twice) · `render_jobs.input_hash` (identical JSON2Video request is not sent twice) · preview 540×960 medium, HD 1080×1920 only after payment · a template can have its own cropped song (`song_mode='fixed'`, free) · template preview uses that song instead of paying ElevenLabs.
**Layers:** `app/api/*` (routers) → `app/services/*` + `pipeline.py` (steps) → `app/providers/elevenlabs.py`, `app/video/json2video.py` · `app/studio/*` (admin template jobs).
**Price:** `templates.custom_price_inr` (optional) is what the app shows and `create_gift` charges; Google Play bills the nearest `price_tiers` tier.

### ADR-007: Hosted APIs on Vercel + Supabase (replaces Droplet + Redis + FFmpeg + ACE-Step)
**Status:** Accepted (2026-11-18). Supersedes the hosting/worker parts of ADR-003 and §4 below.

**Context:** A solo developer should not run servers, queues or GPUs. Auth is already Supabase.
**Decision:**
- **API:** Python FastAPI on Vercel (`backend/`).
- **Data and files:** Supabase Postgres + Storage, schema in `supabase/migrations/`.
- **Song:** ElevenLabs Music (see ADR-008; was Gemini lyrics + Lyria, removed 2026-11-23).
- **Video:** JSON2Video (movie JSON built in code from `templates.render_config`).

**Consequences:**
- Vercel Python has no reliable "work after response", so Supabase drives every step: an insert trigger with `pg_net`, `pg_cron` every minute, plus the JSON2Video webhook. Steps are idempotent; the sweep retries (max 3) and polls renders.
- The app uploads photos/songs straight to Storage (RLS: own `{userId}/` folder only). All other data goes through the API, which checks the Supabase JWT (JWKS).
- HD is rendered only after payment, to save credits.
- Vendor lock-in and per-use cost instead of fixed server cost. Both are fine at launch volume.
- Full setup: `docs/BACKEND_SETUP.md`.

---

## 4. Scale & cost (launch)
- **Vercel:** free / Pro plan, functions up to 300 s.
- **Supabase:** free / Pro plan (DB + Storage + Auth).
- **Song:** Lyria 3 clip ≈ $0.04 per gift (paid tier only).
- **Video:** JSON2Video bills 1 credit per second of output, so 15 credits for the preview + 15 for HD after payment. Render takes ≈ 20–30 s.
- **Storage:** delete source photos after 30 days (privacy + cost). TODO: a cleanup job.

## 5. What to revisit
- Google Play Billing purchase-token verification (`/payments/verify` is fake today)
- Paid JSON2Video plan before launch (free plan = watermark + evaluation only)
- Content moderation of uploaded photos/songs; report + takedown flow (`reports` table exists)
- If JSON2Video/Lyria cost or limits hurt: own FFmpeg worker / own music model behind the same pipeline steps
