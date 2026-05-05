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
          'Подтвердите email',
          'На ваш адрес отправлено письмо со ссылкой. После подтверждения нажмите «Войти». Проверьте и спам.',
          [{ text: 'К входу', onPress: () => router.replace('/(auth)/sign-in') }],
        );
        return;
      }

      router.replace('/(tabs)/map');
    } catch (e) {
      if (__DEV__) {
        console.warn('[signUp]', e);
      }
      Alert.alert('Не удалось зарегистрироваться', formatAuthError(e));
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Регистрация</Text>
          <Text style={styles.subtitle}>Создайте аккаунт рыболова</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <TextField
                label="Имя (необязательно)"
                placeholder="Можно оставить пустым"
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
                label="Пароль"
                secureTextEntry
                autoCapitalize="none"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
              />
            )}
          />

          <PrimaryButton
            title="Создать аккаунт"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Уже есть аккаунт?</Text>
            <Link href="/(auth)/sign-in" style={styles.link}>
              Войти
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
