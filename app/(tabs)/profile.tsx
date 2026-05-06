import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { fetchCatches } from '@/lib/api/catches';
import { fetchProfile, updateDisplayName } from '@/lib/api/profile';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { colors, spacing } from '@/lib/theme';

const schema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(40),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const profileQuery = useQuery({
    queryKey: userId ? queryKeys.profile(userId) : ['profile', 'none'],
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
  });

  const catchesQuery = useQuery({
    queryKey: queryKeys.catches,
    queryFn: fetchCatches,
  });

  const myCount =
    catchesQuery.data?.filter((c) => (userId ? c.user_id === userId : false)).length ?? 0;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '' },
  });

  useEffect(() => {
    const name = profileQuery.data?.display_name;
    if (typeof name === 'string') {
      reset({ displayName: name });
    }
  }, [profileQuery.data?.display_name, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!userId) throw new Error('No user');
      await updateDisplayName(userId, values.displayName.trim());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catches });
      if (userId) await qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      Alert.alert('Saved');
      reset({}, { keepValues: true });
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : String(e)),
  });

  async function onSignOut() {
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.meta}>{session?.user.email}</Text>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>My spots</Text>
          <Text style={styles.statValue}>{myCount}</Text>
        </View>

        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              label="Display name"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.displayName?.message}
            />
          )}
        />

        <PrimaryButton
          title="Save name"
          loading={isSubmitting || saveMutation.isPending}
          disabled={!isDirty}
          onPress={handleSubmit((v) => saveMutation.mutateAsync(v))}
        />

        <Text style={styles.hint}>
          Spot visibility is configured when creating/editing a catch (the "Public" toggle).
        </Text>

        <PrimaryButton variant="ghost" title="Sign out" onPress={onSignOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  meta: { color: colors.textMuted },
  stat: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: { color: colors.text, fontWeight: '700' },
  statValue: { color: colors.primary, fontWeight: '900', fontSize: 18 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
});
