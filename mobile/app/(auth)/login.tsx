import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { AppText, Button, GiftBoxArt, LogoMark, Lottie, Screen } from '@/components';
import { brand } from '@/config/brand';
import { googleErrorMessage } from '@/auth/google';
import { useAuthStore } from '@/store/auth';
import { enterUp, screenPadding, stagger } from '@/theme';

const GoogleG = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48">
    <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </Svg>
);

export default function Login() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [loading, setLoading] = useState(false);

  const onGoogle = async () => {
    setLoading(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) router.replace('/(tabs)');
    } catch (error) {
      const message = await googleErrorMessage(error);
      if (message) Alert.alert('Could not sign in', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen glow="default" scroll={false} contentStyle={styles.content}>
      <Animated.View entering={enterUp(stagger(0))} style={styles.brand}>
        <LogoMark size={34} />
        <AppText variant="h3" style={{ fontFamily: 'Inter_700Bold' }}>
          {brand.name}
        </AppText>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(1))} style={styles.hero}>
        <GiftBoxArt size={230} />
        <Lottie name="notes" style={styles.notes} />
      </Animated.View>

      <Animated.View entering={enterUp(stagger(2))} style={{ gap: 12 }}>
        <AppText variant="display" align="center">
          {'Gift a song they’ll\nnever forget'}
        </AppText>
        <AppText variant="bodySm" color="muted" align="center" style={{ fontSize: 14, lineHeight: 21, paddingHorizontal: 12 }}>
          Add their photos and name. We make a 15-second song video in Bollywood, retro or Gen Z style.
        </AppText>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View entering={enterUp(stagger(3))} style={{ gap: 12, alignSelf: 'stretch' }}>
        <Button variant="light" label="Continue with Google" icon={<GoogleG />} loading={loading} onPress={onGoogle} />
        <Button variant="glass" label="Continue with phone number" onPress={() => router.push('/(auth)/phone')} />
        <AppText variant="caption" align="center" style={{ color: '#6E6884', marginTop: 6, lineHeight: 17 }}>
          For users 18+. By continuing you agree to our Terms and Privacy Policy.
        </AppText>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', paddingHorizontal: screenPadding },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  hero: { marginTop: 16, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  notes: { position: 'absolute', width: 230, height: 230, top: -30 },
});
