import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/theme';

export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
