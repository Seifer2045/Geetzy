# Google sign-in with Supabase — setup guide

How it works: the phone shows the Google account picker (native, no browser) → Google gives an **ID token** →
the app sends it to Supabase (`signInWithIdToken`) → Supabase checks it and creates the user + session.

Code: `mobile/src/auth/google.ts`, `mobile/src/auth/supabase.ts`, `mobile/src/store/auth.ts`.
If the 3 keys in `mobile/.env` are empty, the app keeps the old "any tap signs you in" mode (works in Expo Go).

> Real Google sign-in does **not** work in Expo Go. You need a **development build** (step 6).

---

## 1. Supabase project
1. https://supabase.com → **New project**. Region: **South Asia (Mumbai)**.
2. **Project Settings → API Keys**: copy the **Project URL** and the **anon / publishable** key.
   (Never put the `service_role` / secret key in the app.)

## 2. Google Cloud: consent screen
1. https://console.cloud.google.com → create a project (e.g. "Song Gift App").
2. **Google Auth Platform → Branding**: app name, support email, developer email.
3. **Audience**: External. While in *Testing*, add your Gmail under **Test users**
   (only test users can sign in until you publish the app).
4. **Data access**: the default scopes (`openid`, `email`, `profile`) are enough.

## 3. Google Cloud: Web client (used by Supabase and the app)
**Google Auth Platform → Clients → Create client → Web application**
- Name: `Supabase`
- Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
- Copy the **Client ID** and **Client secret**.

## 4. Google Cloud: Android client (proves the app is really yours)
**Create client → Android**
- Package name: `com.geetzy.app` (from `mobile/app.json` → `android.package`)
- SHA-1: the debug key fingerprint. Get it after the first build (step 6):
  ```powershell
  cd D:\TestApp\mobile\android
  .\gradlew signingReport      # look for "Variant: debug" → SHA1
  ```
  or
  ```powershell
  keytool -list -v -keystore app\debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
The Android client ID is **not** put in the app. It only needs to exist.

## 5. Supabase: turn on Google
**Authentication → Sign In / Providers → Google** → Enable
- **Client IDs**: the **Web** client ID from step 3
- **Client secret**: the Web client secret
- Save.

## 6. App keys + development build
1. Create `mobile/.env` (copy `.env.example`) and fill:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
   ```
2. Phone on USB, then:
   ```powershell
   cd D:\TestApp\mobile
   npx expo run:android        # first time ~10–15 min; installs the dev build on the phone
   ```
3. Do step 4 now (SHA-1), wait ~5 minutes, then tap **Continue with Google**.
4. Daily work after that: `npx expo start` → the dev build app opens it (no rebuild needed for JS changes).
   Rebuild (`npx expo run:android`) only after adding a native package or changing `app.json`.
5. Check: Supabase → **Authentication → Users** shows your Gmail.

---

## Problems
| Error | Fix |
|---|---|
| "not set up for this build (package name or SHA-1…)" (`DEVELOPER_ERROR`, code 10) | Android client missing, wrong SHA-1, or wrong package name. Wait 5 min after fixing. |
| "Unacceptable audience in id_token" | Supabase Google provider → **Client IDs** must contain the **Web** client ID. |
| "needs the development build" | You opened the app in Expo Go. Use the dev build from step 6. |
| Account picker closes, nothing happens | Your Gmail is not a **Test user** (step 2.3). |
| Changed `.env` but nothing changed | Restart `npx expo start` (env is read at start). |

## Before Play Store release
- Play Console → **App integrity → App signing**: copy the **app signing key SHA-1** → add another **Android** client with it
  (and one for the upload key if you test release builds locally / with EAS).
- Publish the Google consent screen (Audience → *In production*).
- If the package name changes (app rename!), create a new Android client for the new package name.
