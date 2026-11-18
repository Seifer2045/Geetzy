import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/api/types';
import { signInWithGoogleNative, signOutGoogle } from '@/auth/google';
import { getSupabase } from '@/auth/supabase';
import { env } from '@/config/env';

type AuthState = {
  user: User | null;
  /** True once we know if someone is signed in (saved session restored). */
  hydrated: boolean;
  /** Returns false if the user closed the Google account picker. */
  signInWithGoogle: () => Promise<boolean>;
  /** Still UI-only. Real phone OTP needs an SMS provider in Supabase (later). */
  signInWithPhone: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const demoUser = (phone: string | null): User => ({
  id: 'USR-1',
  name: 'Rahul Sharma',
  email: 'rahul.sharma@gmail.com',
  phone,
});

const toUser = (u: SupabaseUser): User => ({
  id: u.id,
  name: u.user_metadata.full_name ?? u.user_metadata.name ?? u.email?.split('@')[0] ?? 'Friend',
  email: u.email ?? '',
  phone: u.phone || null,
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,

      signInWithGoogle: async () => {
        if (!env.realAuth) {
          await wait(700);
          set({ user: demoUser(null) });
          return true;
        }
        const supabaseUser = await signInWithGoogleNative();
        if (!supabaseUser) return false;
        set({ user: toUser(supabaseUser) });
        return true;
      },

      signInWithPhone: async (phone) => {
        await wait(700);
        set({ user: demoUser(phone) });
      },

      signOut: async () => {
        set({ user: null });
        if (!env.realAuth) return;
        await Promise.all([getSupabase().auth.signOut(), signOutGoogle()]);
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      // With real auth, Supabase saves the session itself. We only save the demo user.
      partialize: (s) => (env.realAuth ? {} : { user: s.user }),
      onRehydrateStorage: () => () => {
        if (!env.realAuth) useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Call once at app start. Keeps `user` in sync with the Supabase session. Returns a cleanup function. */
export const initAuth = (): (() => void) => {
  if (!env.realAuth) return () => undefined;

  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    useAuthStore.setState({ user: session ? toUser(session.user) : null });
    if (event === 'INITIAL_SESSION') useAuthStore.setState({ hydrated: true });
  });
  return () => data.subscription.unsubscribe();
};
