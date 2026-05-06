import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth';
import { formatAuthError } from '@/lib/authHelpers';
import { type SignInValues, signInSchema } from '@/lib/authForms';
import { colors, spacing } from '@/lib/theme';

function showAuthAlert(title: string, message: string) {
  if (Platform.OS === 'web') return;
  Alert.alert(title, message);
}

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });
  const emailValue = watch('email');
  const passwordValue = watch('password');

  useEffect(() => {
    if (submitError) setSubmitError(null);
    if (submitInfo) setSubmitInfo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailValue, passwordValue]);

  async function onSubmit(values: SignInValues) {
    try {
      setSubmitError(null);
      setSubmitInfo('Signing in…');
      await signIn(values.email.trim(), values.password);
      setSubmitInfo('Signed in. Loading your map…');
    } catch (e) {
      if (__DEV__) {
        console.warn('[signIn]', e);
      }
      const msg = formatAuthError(e);
      setSubmitError(msg);
      if (/confirm your email/i.test(msg)) {
        setSubmitInfo(
          'Your account exists, but email is not confirmed yet. Open inbox/spam, tap the confirmation link, then try Sign in again.',
        );
      } else if (/invalid email or password/i.test(msg)) {
        setSubmitInfo(
          'Wrong password or unknown email. If you already registered this email, use Sign in. To create a new account, use Create one.',
        );
      } else {
        setSubmitInfo(null);
      }
      showAuthAlert('Sign-in failed', msg);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Rybalka</Text>
          <Text style={styles.subtitle}>Sign in to open the map</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.email?.message}
                editable={!isSubmitting}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label="Password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
                editable={!isSubmitting}
              />
            )}
          />
          <Text style={styles.hint}>Use the same email and password as in confirmation email flow.</Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.hint}>
              Web note: auth messages appear inline below. If confirmation is required, check inbox and spam.
            </Text>
          ) : null}

          {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}
          {submitInfo ? <Text style={styles.infoBanner}>{submitInfo}</Text> : null}

          <PrimaryButton
            title="Sign in"
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>No account yet?</Text>
            <Link href="/(auth)/sign-up" style={styles.link}>
              Create one
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: spacing.xxl },
  header: { gap: spacing.xs },
  title: { fontSize: 36, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  form: { gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: -2 },
  errorBanner: {
    color: colors.danger,
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  infoBanner: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  footerText: { color: colors.textMuted },
  link: { color: colors.link, fontWeight: '600' },
});
