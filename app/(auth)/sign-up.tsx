import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth';
import { extractRetryAfterSeconds, formatAuthError } from '@/lib/authHelpers';
import { type SignUpValues, signUpSchema } from '@/lib/authForms';
import { colors, spacing } from '@/lib/theme';

function showAuthAlert(title: string, message: string) {
  if (Platform.OS === 'web') return;
  Alert.alert(title, message);
}

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [cooldownUntilTs, setCooldownUntilTs] = useState<number>(0);
  const [cooldownNow, setCooldownNow] = useState<number>(Date.now());
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });
  const displayNameValue = watch('displayName');
  const emailValue = watch('email');
  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirmPassword');
  const cooldownLeftSec = Math.max(0, Math.ceil((cooldownUntilTs - cooldownNow) / 1000));
  const inCooldown = cooldownLeftSec > 0;

  useEffect(() => {
    if (!inCooldown) return;
    const id = setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inCooldown]);

  useEffect(() => {
    if (submitError) setSubmitError(null);
    if (submitInfo) setSubmitInfo(null);
    if (sentToEmail) setSentToEmail(null);
    if (emailAlreadyRegistered) setEmailAlreadyRegistered(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayNameValue, emailValue, passwordValue, confirmPasswordValue]);

  async function onSubmit(values: SignUpValues) {
    try {
      if (inCooldown) return;
      setSubmitError(null);
      setEmailAlreadyRegistered(false);
      setSentToEmail(null);
      setSubmitInfo('Creating account…');
      const cleanEmail = values.email.trim().toLowerCase();
      const result = await signUp(cleanEmail, values.password, values.displayName.trim());

      if (result.needsEmailConfirmation) {
        setSentToEmail(cleanEmail);
        setSubmitInfo(
          'Confirmation email sent. Open inbox and spam/junk, confirm the email, then sign in.',
        );
        const confirmMsg =
          'We sent a confirmation link to your inbox. After confirming, tap "Sign in". Also check your spam folder.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          showAuthAlert('Confirm your email', confirmMsg);
        } else {
          Alert.alert('Confirm your email', confirmMsg, [
            { text: 'Go to sign in', onPress: () => router.replace('/(auth)/sign-in') },
          ]);
        }
        return;
      }

      router.replace('/(tabs)/map');
    } catch (e) {
      if (__DEV__) {
        console.warn('[signUp]', e);
      }
      const msg = formatAuthError(e);
      const rawMsg = e instanceof Error ? e.message : String(e);
      setSubmitError(msg);
      setSubmitInfo(null);
      const alreadyRegistered = /already registered|already exists|already been registered/i.test(msg);
      if (alreadyRegistered) {
        setEmailAlreadyRegistered(true);
        setSubmitInfo('This email already has an account. Use Sign in to continue.');
      }
      const retryAfterSec = extractRetryAfterSeconds(rawMsg) ?? extractRetryAfterSeconds(msg);
      if (retryAfterSec !== null) {
        setCooldownUntilTs(Date.now() + retryAfterSec * 1000);
        setCooldownNow(Date.now());
      } else if (/confirmation emails were requested/i.test(msg) || /rate limit/i.test(msg)) {
        setCooldownUntilTs(Date.now() + 120_000);
        setCooldownNow(Date.now());
      }
      showAuthAlert('Sign-up failed', msg);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Set up your angler profile</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <TextField
                label="Name (optional)"
                placeholder="You can leave this empty"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.displayName?.message}
                editable={!isSubmitting && !inCooldown}
              />
            )}
          />
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
                editable={!isSubmitting && !inCooldown}
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
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
                editable={!isSubmitting && !inCooldown}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <TextField
                label="Repeat password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.confirmPassword?.message}
                editable={!isSubmitting && !inCooldown}
              />
            )}
          />
          <Text style={styles.hint}>
            Password: 8+ characters. After submit you will see whether a confirmation email was sent and to which address.
            If the email is already registered, you will see an explicit message — use Sign in instead.
          </Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.hint}>
              Web note: messages are shown inline below. Keep this page open until you see the final status.
            </Text>
          ) : null}

          {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}
          {submitInfo ? <Text style={styles.infoBanner}>{submitInfo}</Text> : null}
          {sentToEmail ? (
            <Text style={styles.infoBanner}>
              Email sent to {sentToEmail}. If it does not arrive in 1-2 minutes, check spam/junk and then retry.
            </Text>
          ) : null}
          {inCooldown ? (
            <Text style={styles.cooldownBanner}>
              Too many attempts. Please wait {cooldownLeftSec}s before trying again.
            </Text>
          ) : null}

          <PrimaryButton
            title={inCooldown ? `Wait ${cooldownLeftSec}s` : 'Create account'}
            loading={isSubmitting}
            disabled={!isValid || isSubmitting || inCooldown}
            onPress={handleSubmit(onSubmit)}
          />
          {sentToEmail || emailAlreadyRegistered ? (
            <PrimaryButton
              title="Go to sign in"
              variant="ghost"
              onPress={() => router.replace('/(auth)/sign-in')}
            />
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/sign-in" style={styles.link}>
              Sign in
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
  title: { fontSize: 32, fontWeight: '800', color: colors.text },
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
  cooldownBanner: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  footerText: { color: colors.textMuted },
  link: { color: colors.link, fontWeight: '600' },
});
