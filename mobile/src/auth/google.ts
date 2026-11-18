import type { User as SupabaseUser } from '@supabase/supabase-js';
import { env } from '@/config/env';
import { getSupabase } from './supabase';

// The Google Sign-In native module is NOT in Expo Go, so importing it there crashes.
// We load it only when real auth is on (which needs a development build).
const loadGoogleSignIn = () => import('@react-native-google-signin/google-signin');

let configured = false;

/**
 * Shows the Google account picker, then signs in to Supabase with the Google ID token.
 * Returns null if the user closed the picker.
 */
export const signInWithGoogleNative = async (): Promise<SupabaseUser | null> => {
  const { GoogleSignin, isSuccessResponse } = await loadGoogleSignIn();

  if (!configured) {
    // Must be the WEB client ID (not the Android one). Supabase checks the token against it.
    GoogleSignin.configure({ webClientId: env.googleWebClientId });
    configured = true;
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;

  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');

  const { data, error } = await getSupabase().auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
  return data.user;
};

/** Clears the Google account too, so the picker shows again next time. */
export const signOutGoogle = async () => {
  const { GoogleSignin } = await loadGoogleSignIn();
  await GoogleSignin.signOut().catch(() => undefined);
};

/** Turns Google/Supabase errors into a short message for the user. */
export const googleErrorMessage = async (error: unknown): Promise<string | null> => {
  const googleSignIn = await loadGoogleSignIn().catch(() => null);
  if (!googleSignIn) return 'Google sign-in needs the development build. It does not work in Expo Go.';

  const { isErrorWithCode, statusCodes } = googleSignIn;
  if (!isErrorWithCode(error)) return error instanceof Error ? error.message : 'Something went wrong. Please try again.';

  switch (error.code) {
    case statusCodes.IN_PROGRESS:
      return null; // a sign-in is already open, nothing to show
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services is missing or out of date on this phone.';
    case '10': // DEVELOPER_ERROR
      return 'Google sign-in is not set up for this build (package name or SHA-1 does not match).';
    default:
      return error.message;
  }
};
