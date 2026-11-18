# Session handoff — decisions made in the planning chat (Nov 16–17, 2026)

## Product
- Idea: personalised AI song + video gifting. Occasions at launch: Birthday, Anniversary, Apology. Festivals (Diwali, Rakhi…) added later as templates (server-driven, no app update).
- Video length **15 s**, **3–5 photos**, styles: **Bollywood, Retro, Gen Z**.
- Audience: Gen Z + adults. App users must be **18+** (videos can be *about* anyone, incl. kids; kids' photos kept private and auto-deleted).
- Language: Indian English lyrics.
- Song: **AI-generated** song (name + fun fact in lyrics, mood, singer, 3 versions, limited re-tries) **or user uploads own song** from device → trim to 15 s (rights checkbox, report button, no in-app film-song catalogue).
- Voice cloning: later, not v1. Face effects: not v1. User editing of video: no (pick template only).
- Price: **₹49 per video** (dynamic per template; shown on Template Preview with optional original price + discount badge). Free watermarked preview first.
  Rough maths: ₹49 incl. 18% GST → ~₹41.5 → minus ~15% Play fee → ~₹35 to us; cost per video ~₹1–2.
- Login: Google sign-in + phone OTP (UI done; provider undecided — Supabase or Firebase).
- Solo developer.

## Tech
- Mobile: Expo + TypeScript (React Native CLI experience), Android first.
- Backend: Python FastAPI, Redis job queue, FFmpeg renderer (template JSON → 1080×1920 MP4), storage R2 / DO Spaces / Supabase Storage.
- Models from Hugging Face, self-hosted on **DigitalOcean**:
  - Hugging Face free tiers (Inference Providers ~$0.10/month credit, ZeroGPU few minutes/day) are only for testing.
  - Plain CPU droplets can't run music models usefully. GPU droplet RTX 4000 Ada ≈ $0.76/hr ≈ ~₹45–50k/month always-on → only worth it at ~50+ videos/day.
  - Plan: CPU droplet (API + Redis + FFmpeg) now; song via hosted ACE-Step pay-per-use; move ACE-Step to own GPU droplet later. Keep song generation behind one function `generate_song(lyrics, style)`.
  - **ACE-Step 1.5 = MIT (commercial OK)**. **MusicGen weights = CC-BY-NC (not allowed)**. FLUX.1-schnell Apache 2.0 OK for design assets; FLUX.1-dev non-commercial.
  - AI video generation is NOT needed — FFmpeg templates are enough.
- Play Billing price tiers instead of a product per template.
- Native splash (expo-splash-screen, logo on `#0A0A0F`) → animated JS splash (Android 12+ always shows system splash first).

## Name
- App renamed to **Geetzy** on 2026-11-17 (placeholder "Tarana" was a Tarana Wireless trademark). Android package is now `com.geetzy.app`, deep-link scheme `geetzy://`.
- Unused-looking candidates found: **Geetara** (geet + tara), **SurTohfa** (sur + tohfa), Dhunify, Giftune, Wishtune. Avoid: "Tohfa" (jewellery app), "Dhun" (Pakistani music app).
- Before final: check Play Store, domain (.com/.in), IP India trademark search (class 9 & 41), Instagram handle.

## Design (Figma)
- File: https://www.figma.com/design/Ks2310t6X3D4iBAtzyUD44 — pages: "Page 1" (v1, old) and **"v2 – Premium"** (current).
- v2 screens: 00 Splash (animated in Figma, 2.8 s), 01 Login, 02 Home, 03 Choose template, 03b Template preview (name, ID, dynamic price), 04 Photos & details, 05 Pick the song (AI), 05b Upload song, 05c Trim song, 06 Making video, 07 Preview & pay, 09 Profile, 10 Explore, 11 Library, + "Motion & Lottie spec" panel and "Components v2" board.
- Known small Figma fixes still pending (rate limit hit): on 05 the song title is truncated; on 05c "Auto-pick chorus" label is clipped and the second option row hides under the footer.
- Figma MCP on Starter plan has a very small monthly tool-call limit → avoid Figma reads; upgrade to Professional (Full seat) for heavy design work.

## Code status
- Generated on 2026-11-17 into `D:\TestApp` (74 files). Not yet installed/run. See `CLAUDE.md` → Status and Next steps.
- 2026-11-17: installed (Expo SDK 58), Google sign-in via Supabase Auth, app renamed **Geetzy** (`com.geetzy.app`).
- 2026-11-18: real backend written: FastAPI on **Vercel**, **Supabase** Postgres + Storage, **Gemini** lyrics + **Lyria 3** song, **JSON2Video** render (ADR-007 in ARCHITECTURE.md). Deploy steps: `docs/BACKEND_SETUP.md`.
