import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const seg = segments as readonly string[];
    const inAuthGroup = seg[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/sign-in');
      }
      return;
    }

    // Есть сессия: уводим с (auth). Пустой segments — часто сразу после signIn, пока дерево не обновилось.
    if (inAuthGroup || seg.length === 0) {
      router.replace('/(tabs)/map');
    }
  }, [session, loading, segments, router]);

  // Только сессия Supabase — не ждём navState для UI: иначе Stack не монтируется,
  // useRootNavigationState() так и остаётся без key → вечный спиннер.
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
