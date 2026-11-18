# Geetzy — AI song video gifts

```
TestApp/
├─ mobile/    Expo app (TypeScript, expo-router) — all screens from Figma "v2 – Premium"
├─ backend/   FastAPI mock API (same contract as the app's mock data)
└─ docs/      ARCHITECTURE.md (ADRs + system design), DESIGN_SYSTEM.md (tokens, components, motion)
```

## Run the app (Windows, phone on USB)

```powershell
cd D:\TestApp\mobile
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # first time only (installs SDK-matched packages)
npx expo start                                         # then press "a" (USB debugging on) or scan with Expo Go
```

- Works fully with **sample data** (no backend needed). Login is UI-only: any button signs you in.
- All native modules used are included in **Expo Go**, so no custom build is needed yet.
- `npx expo-doctor` checks versions if anything looks off.

## Use the backend instead of sample data

```powershell
cd D:\TestApp\backend
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then create `mobile\.env` from `.env.example` with `EXPO_PUBLIC_USE_MOCK=false` and
`EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000`, and restart `npx expo start`.

## Where things are (mobile)

| Path | What |
|---|---|
| `app/_layout.tsx` | fonts, providers, native → animated splash hand-off |
| `app/(auth)/login.tsx`, `phone.tsx` | Login (Google / phone + OTP UI) |
| `app/(tabs)/` | Home · Explore · Library · Profile (custom glass tab bar with ＋ Create) |
| `app/create/` | templates → template/[id] preview → details → song (AI / upload) → trim → making → preview & pay |
| `src/theme/tokens.ts` | colors, gradients, type scale, spacing, radius, motion |
| `src/components/` | Button, Chip, Segmented, TopBar, TemplateCard, TabBar, Waveform, Lottie, AnimatedSplash… |
| `src/api/` | `types.ts` contract, `mock.ts` sample API, `http.ts` real API, `hooks.ts` React Query |
| `src/store/` | zustand: auth session, create-flow draft |
| `assets/lottie/` | confetti-burst, equalizer, music-notes (replace with LottieFiles exports, same names) |

## Rename the app
`src/config/brand.ts` + `app.json` (`name`, `slug`, `scheme`, `android.package`).
