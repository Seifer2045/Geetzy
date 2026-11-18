import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CreateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="making" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="preview" options={{ animation: 'fade' }} />
    </Stack>
  );
}
