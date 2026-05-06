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

    // Session exists: redirect away from (auth). Empty segments often happen right after signIn before tree refresh.
    if (inAuthGroup || seg.length === 0) {
      router.replace('/(tabs)/map');
    }
  }, [session, loading, segments, router]);

  // Gate only on Supabase session and do not wait for navState in UI;
  // otherwise Stack can fail to mount and useRootNavigationState() stays keyless -> infinite spinner.
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
