import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth';
import { formatAuthError } from '@/lib/authHelpers';
import { type SignInValues, signInSchema } from '@/lib/authForms';
import { colors, spacing } from '@/lib/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInValues) {
    try {
      await signIn(values.email.trim(), values.password);
    } catch (e) {
      if (__DEV__) {
        console.warn('[signIn]', e);
      }
      Alert.alert('Не удалось войти', formatAuthError(e));
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Рыбалка</Text>
          <Text style={styles.subtitle}>Войдите, чтобы открыть карту</Text>
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
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label="Пароль"
                secureTextEntry
                autoCapitalize="none"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
              />
            )}
          />

          <PrimaryButton title="Войти" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Нет аккаунта?</Text>
            <Link href="/(auth)/sign-up" style={styles.link}>
              Зарегистрироваться
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
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  footerText: { color: colors.textMuted },
  link: { color: colors.link, fontWeight: '600' },
});
