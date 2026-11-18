import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, type TextInputInstance, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppText, Button, Input, Screen, TopBar } from '@/components';
import { useAuthStore } from '@/store/auth';
import { colors, enterUp, exitUp, fonts, radius, screenPadding } from '@/theme';

const OTP_LENGTH = 6;

export default function PhoneLogin() {
  const signInWithPhone = useAuthStore((s) => s.signInWithPhone);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<TextInputInstance>(null);

  const validPhone = /^[6-9]\d{9}$/.test(phone);

  const sendOtp = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600)); // mock SMS
    setLoading(false);
    setStep('otp');
    setTimeout(() => otpRef.current?.focus(), 350);
  };

  const verify = async () => {
    setLoading(true);
    await signInWithPhone(`+91${phone}`);
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen glow="top" scroll={false} contentStyle={{ flex: 1 }}>
        <TopBar title="" onBack={() => (step === 'otp' ? setStep('phone') : router.back())} />
        <View style={styles.body}>
          {step === 'phone' ? (
            <Animated.View key="phone" entering={enterUp(0)} exiting={exitUp} style={{ gap: 24 }}>
              <View style={{ gap: 8 }}>
                <AppText variant="h1">Your phone number</AppText>
                <AppText variant="bodySm" color="muted">
                  We’ll send a 6-digit code to verify it.
                </AppText>
              </View>
              <Input label="Mobile number" prefix="+91" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} placeholder="98765 43210" autoFocus />
            </Animated.View>
          ) : (
            <Animated.View key="otp" entering={enterUp(0)} exiting={exitUp} style={{ gap: 24 }}>
              <View style={{ gap: 8 }}>
                <AppText variant="h1">Enter the code</AppText>
                <AppText variant="bodySm" color="muted">
                  {`Sent to +91 ${phone}. For testing, any 6 digits work.`}
                </AppText>
              </View>
              <View>
                <TextInput
                  ref={otpRef}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  style={styles.hiddenInput}
                  accessibilityLabel="One-time code"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                />
                <View style={styles.otpRow} pointerEvents="none">
                  {Array.from({ length: OTP_LENGTH }, (_, i) => {
                    const ch = otp[i];
                    const active = i === otp.length;
                    return (
                      <View key={i} style={[styles.otpBox, active && styles.otpActive, ch ? styles.otpFilled : null]}>
                        <AppText variant="h3" style={{ fontFamily: fonts.bold }}>
                          {ch ?? ''}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              </View>
              <AppText variant="label" color="pinkSoft">
                Resend code in 0:28
              </AppText>
            </Animated.View>
          )}
          <View style={{ flex: 1 }} />
          {step === 'phone' ? (
            <Button label="Send code" disabled={!validPhone} loading={loading} onPress={sendOtp} />
          ) : (
            <Button label="Verify & continue" disabled={otp.length < OTP_LENGTH} loading={loading} onPress={verify} />
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: screenPadding, paddingTop: 12 },
  hiddenInput: { position: 'absolute', width: '100%', height: 56, opacity: 0.01, zIndex: 2 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md + 2,
    backgroundColor: colors.glassSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpActive: { borderColor: colors.pink, backgroundColor: 'rgba(255,77,141,0.06)' },
  otpFilled: { borderColor: colors.borderStrong },
});
