import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth';
import { formatAuthError } from '@/lib/authHelpers';
import { type SignUpValues, signUpSchema } from '@/lib/authForms';
import { colors, spacing } from '@/lib/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpValues) {
    try {
      const result = await signUp(values.email.trim(), values.password, values.displayName.trim());

      if (result.needsEmailConfirmation) {
        Alert.alert(
          'Confirm your email',
          'We sent a confirmation link to your inbox. After confirming, tap "Sign in". Also check your spam folder.',
          [{ text: 'Go to sign in', onPress: () => router.replace('/(auth)/sign-in') }],
        );
        return;
      }

      router.replace('/(tabs)/map');
    } catch (e) {
      if (__DEV__) {
        console.warn('[signUp]', e);
      }
      Alert.alert('Sign-up failed', formatAuthError(e));
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
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
              />
            )}
          />

          <PrimaryButton
            title="Create account"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />

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
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  footerText: { color: colors.textMuted },
  link: { color: colors.link, fontWeight: '600' },
});
