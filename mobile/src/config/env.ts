const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const env = {
  useMock: process.env.EXPO_PUBLIC_USE_MOCK !== 'false',
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
  supabaseUrl,
  supabaseAnonKey,
  googleWebClientId,
  /** Real Google sign-in (Supabase) only when all three keys are set. Otherwise any tap signs you in. */
  realAuth: Boolean(supabaseUrl && supabaseAnonKey && googleWebClientId),
} as const;
