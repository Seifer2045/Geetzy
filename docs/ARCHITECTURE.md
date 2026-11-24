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

### ADR-014: Grok (xAI) removed; templates are JSON2Video JSON (2026-11-24)
**Decision:** no xAI key, no Grok design, no AI background picture or clip (ADR-009, -010 and -013 are superseded). JSON2Video has no "design from a prompt", so the admin brings the design: a **starter template** from code (`video/presets.py`, five full designs) or **JSON pasted from the JSON2Video Editor**. It is stored in `templates.movie_json` and rendered for every gift by `video/native_template.py` (validate on save, render with placeholders, drop and stretch scenes, add song / name voice / watermark, force size, webhook and client data). The older compact format still renders. The admin preview plays the template with the ElevenLabs song (AI sample from the template's audio prompt, cached, or the admin's own song).
**Rules found with real renders (JSON2Video):** an `html` layer collapses to nothing unless its div has pixel sizes; an `image` with `resize: "cover"` ignores `width`/`height` (the photo spills out of its box), so boxed photos carry no `resize`; credits are per second at any resolution, so preview and HD both use 1080 x 1920 and only HD is high quality and watermark-free.
**Photos:** user photos still replace the placeholders, each cut to its frame with the face placed well (ADR-012). Frames come from the element's `width` x `height`.
**Cost:** nothing per template any more (no Grok). JSON2Video seconds per preview and per HD video; ElevenLabs once per song.
**Open:** the starters were rendered on a free JSON2Video plan (small JSON2Video.com mark); a paid plan removes it before launch.

### ADR-013: Different video templates per prompt: free layout, background picture, safe layers (2026-11-23)
**Problem:** a Grok design looked the same for every prompt and its title was invisible. Causes: the frame art (the whole background with transparent photo holes) was added movie-wide at z 10, above Grok's text (z 5) and over scenes without a photo; the movie JSON can only place photos and text (no petals, glow, bokeh); one example layout was copied; the old preview stayed in the row.
**Decision:** (1) renderer: text z is always >= 20, the frame is drawn only in scenes that have a photo (z 10), photos stay under it, and a template background picture is added when the JSON forgot it. This fixes existing templates at the next render. (2) New layout `free` ("Free design, no frame", first in the picker, the default): Grok chooses every photo box. (3) Grok also returns `background_prompt` (popped before validation, saved in `templates.bgimage_prompt` / `bgimage_suggested`); `services/bgimage.py` makes ONE 9:16 picture from it (xAI image API, admin click, synchronous, cap `XAI_IMAGE_JOBS_PER_DAY`, hash skip, logged as `ai_requests.kind='image'`) and stores it as the template's `art_upload_path`, so art, preview and gifts need no other change. (4) Four different example layouts, temperature 0.8, `PROMPT_VERSION` in the brief hash (a changed prompt designs the same brief again), and a new design clears the stale preview.
**Cost:** Grok chat once per click (unchanged); one image call per click; nothing per gift.
**Unverified:** xAI image endpoint fields / price (`providers/xai.generate_image`), and JSON2Video z-order of a background picture under photos and text.

### ADR-012: Every photo is cut for the frame it is shown in (2026-11-23)
**Problem:** photos come in any size and orientation; JSON2Video's `cover` crops around the picture's centre and our old sideways `pan` slid it further, so faces were cut or drifted out.
**Decision:** before a render, `services/photo_prep.py` cuts each photo once per distinct frame (`video/framing.py`): the frame's exact aspect, all faces (OpenCV YuNet, `video/faces.py`) together at 50% across / 40% from the top, clamped to the photo; no face = a numpy edge-and-contrast smart crop. Frames come from the same box logic the renderer uses (`movie_template.photo_frames`, `json2video.builtin_frames`, `render_body.photo_frames`), keyed `"{photo}:{w}x{h}"` at HD size, so preview and HD use the same file (`gift-media/{user}/{gift}/clean/…`, reused by retries). Any failure falls back to a clean full copy, then the original upload. User photos only zoom slowly; no `pan`.
**Why not sharp / ffmpeg:** sharp is Node-only (backend = Python on Vercel) and cannot find faces; ffmpeg cannot find faces. OpenCV's saliency lives in `opencv-contrib` (too big), so the smart crop is plain numpy.
**Unverified:** JSON2Video's centred `zoom` on an already-fitted image; YuNet on profile or tiny faces (they fall back to the smart crop).

### ADR-011: Personal song made on the phone, one per video (2026-11-23)
**Decision:** the song screen has Relationship, Nature (max 3), Language, Music style, Mood, Singer and a free "idea" box. "Make my song" calls `POST /songs/draft` (`api/songs.py`, `services/song_draft.py`); the prompt is built in code from ids and cleaned text (`services/song_prompt.py`: admin brief, who/what/fun fact, sound, fixed rules, user idea last). The user listens (`SongPlayer`, expo-video) and "Use this song" creates the gift with `draftId`; `create_gift` stores the draft's MP3 in `gift_songs.audio_path`, so the pipeline makes **no second ElevenLabs call**.
**Cost rules:** one song per create flow (the draft id is the primary key of `song_drafts`, claimed before the call, so a double tap cannot pay twice; HTTP 402 afterwards, a paid re-make comes later) · `SONG_DRAFTS_PER_DAY` per user (429) · song cache · a failed ElevenLabs call removes the draft row, so the try is not used · every real call is logged in `ai_requests`.
**Fallback:** a gift without a draft (old app) still gets its song made by the pipeline with the same prompt (`song_prompt.gift_prompt`).
**Unverified:** how well ElevenLabs follows language / name instructions, and which prompts it rejects (copyright errors become a friendly 422).

### ADR-010: Grok Imagine background clip with a replaceable photo window (2026-11-27)
**Decision:** the admin writes a prompt, xAI **Grok Imagine** makes ONE silent 9:16 clip per template (`services/bgvideo.py`, `providers/xai.py`). The prompt always asks for a flat green (#00B140) rectangle where the photo goes. The clip waits for the admin's approval as a *candidate*; "Use this clip" copies it to `templates.bgvideo_path`.
**Replaceable image:** a finished video cannot have pixels swapped, so JSON2Video puts the user photo UNDER the clip and keys the green out (`bgvideo_mode='window'`, box in `bgvideo_window`). After download the backend checks the window on 5 frames (`video/window_check.py`, PyAV + Pillow): clean rectangle, big enough, still. If it fails, the admin can use `overlay` mode (clip as background, photo on top in the layout box, transparent frame art `art.frame_only`). Every `{{photo_k}}` in the movie JSON is also a marker with a required `box`, and `render_template` refuses to output any leftover `{{...}}`.
**Why not wait inside one request:** xAI takes minutes, Vercel stops a request at 300 s. `start()` stores the xAI `request_id`; the minute sweep (`poll_running`) resumes the job (own 20-minute timeout, not the 6-minute rule).
**Cost:** once per template, never per gift · same prompt + settings = no call (`bgvideo_hash`) · daily cap `XAI_VIDEO_JOBS_PER_DAY` · logged as `ai_requests.kind='video'` · gifts freeze `bgvideo_path/mode/window` in `gifts.design`.
**Unverified (check on first real run):** xAI video model/fields, JSON2Video `video` element fields (`muted`, `loop`, `chroma-key`), credit use of video inputs.

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
