import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { env } from '@/config/env';

let client: SupabaseClient | null = null;

/** Created on first use, so the app still starts when the Supabase keys are not set yet. */
export const getSupabase = (): SupabaseClient => {
  if (client) return client;

  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage, // session survives app restarts
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Refresh the login token only while the app is open (Supabase's advice for React Native).
  const supabase = client;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });

  return client;
};
