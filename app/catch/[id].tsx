import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import {
  deleteCatch,
  fetchCatchById,
  resolveCatchPhotoPublicUrls,
  resolveCatchPhotoSignedUrls,
  updateCatch,
  uploadCatchPhotos,
} from '@/lib/api/catches';
import { useAuth } from '@/lib/auth';
import { type CatchFormValues, catchFormSchema } from '@/lib/catchForm';
import { queryKeys } from '@/lib/queryKeys';
import { colors, spacing } from '@/lib/theme';

type FormValues = CatchFormValues;

export default function CatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();

  const [editing, setEditing] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  /** Signed URLs override public URLs when available. */
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: queryKeys.catch(id),
    queryFn: () => fetchCatchById(id),
    enabled: !!id,
  });

  const isOwner = useMemo(() => !!session?.user.id && session.user.id === query.data?.user_id, [
    query.data?.user_id,
    session?.user.id,
  ]);

  const publicPhotoUrls = useMemo(() => {
    const row = query.data;
    if (!row?.catch_photos?.length) return {};
    return resolveCatchPhotoPublicUrls(row.catch_photos);
  }, [query.data]);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(catchFormSchema),
    defaultValues: {
      fish_species: '',
      weight_g: '',
      bait: '',
      gear: '',
      notes: '',
      is_public: true,
    },
  });

  useEffect(() => {
    const c = query.data;
    if (!c) return;
    reset({
      fish_species: c.fish_species ?? '',
      weight_g: c.weight_g != null ? String(c.weight_g) : '',
      bait: c.bait ?? '',
      gear: c.gear ?? '',
      notes: c.notes ?? '',
      is_public: c.is_public,
    });
  }, [query.data, reset]);

  useEffect(() => {
    const row = query.data;
    if (!row?.catch_photos?.length) {
      setSignedPhotoUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const urls = await resolveCatchPhotoSignedUrls(row.catch_photos);
        if (!cancelled) setSignedPhotoUrls(urls);
      } catch {
        if (!cancelled) setSignedPhotoUrls({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const weightRaw = values.weight_g?.trim();
      const weight = weightRaw ? Number(weightRaw) : null;
      if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
        throw new Error('Invalid weight');
      }

      await updateCatch(id, {
        fish_species: values.fish_species?.trim() ? values.fish_species.trim() : null,
        weight_g: weight,
        bait: values.bait?.trim() ? values.bait.trim() : null,
        gear: values.gear?.trim() ? values.gear.trim() : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        is_public: values.is_public,
      });

      if (newPhotos.length > 0) {
        await uploadCatchPhotos(id, newPhotos);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catch(id) });
      await qc.invalidateQueries({ queryKey: queryKeys.catches });
      setNewPhotos([]);
      setEditing(false);
      Alert.alert('Saved');
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => deleteCatch(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catches });
      router.replace('/(tabs)/map');
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : String(e)),
  });

  async function pickMorePhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (res.canceled) return;
    setNewPhotos((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, 8));
  }

  function confirmDelete() {
    Alert.alert('Delete catch?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  if (query.isLoading) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  if (!query.data) {
    return (
      <Screen>
        <Text style={styles.muted}>Catch not found</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const c = query.data;

  return (
    <Screen edges={['bottom']} padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{c.fish_species?.trim() ? c.fish_species : 'Catch'}</Text>
        <Text style={styles.meta}>
          {c.author_name ?? 'Angler'} · {new Date(c.caught_at).toLocaleString('en-US')}
        </Text>
        <Text style={styles.meta}>
          {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
        </Text>

        {!editing ? (
          <View style={styles.card}>
            <Row label="Weight" value={c.weight_g != null ? `${c.weight_g} g` : '—'} />
            <Row label="Bait" value={c.bait ?? '—'} />
            <Row label="Gear" value={c.gear ?? '—'} />
            <Row label="Notes" value={c.notes ?? '—'} />
            <Row label="Visibility" value={c.is_public ? 'Public' : 'Private'} />
          </View>
        ) : (
          <View style={styles.form}>
            <Controller
              control={control}
              name="fish_species"
              render={({ field }) => (
                <TextField label="Species" value={field.value} onChangeText={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="weight_g"
              render={({ field }) => (
                <TextField label="Weight (grams)" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="bait"
              render={({ field }) => (
                <TextField label="Bait / groundbait" value={field.value} onChangeText={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="gear"
              render={({ field }) => (
                <TextField label="Gear" value={field.value} onChangeText={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <TextField
                  label="Notes"
                  multiline
                  style={{ minHeight: 96, textAlignVertical: 'top' }}
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="is_public"
              render={({ field }) => (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Public point</Text>
                  <Switch
                    value={field.value}
                    onValueChange={field.onChange}
                    thumbColor={colors.primary}
                    trackColor={{ false: colors.border, true: colors.primaryDark }}
                  />
                </View>
              )}
            />

            <PrimaryButton variant="ghost" title="Add photo" onPress={pickMorePhotos} />
            {newPhotos.length > 0 ? (
              <Text style={styles.muted}>New photos to upload: {newPhotos.length}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.gallery}>
          {c.catch_photos.map((p) => {
            const uri = signedPhotoUrls[p.id] ?? publicPhotoUrls[p.id];
            return uri ? (
              <Image
                key={p.id}
                source={{ uri }}
                style={styles.photo}
                contentFit="cover"
                recyclingKey={p.id}
              />
            ) : (
              <View key={p.id} style={[styles.photo, styles.photoPending]} />
            );
          })}
          {newPhotos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photoNew} contentFit="cover" />
          ))}
        </View>

        {isOwner ? (
          <View style={styles.actions}>
            {!editing ? (
              <>
                <PrimaryButton title="Edit" onPress={() => setEditing(true)} />
                <PrimaryButton variant="danger" title="Delete" onPress={confirmDelete} />
              </>
            ) : (
              <>
                <PrimaryButton
                  title="Save"
                  loading={saveMutation.isPending}
                  onPress={handleSubmit((v) => saveMutation.mutateAsync(v))}
                />
                <PrimaryButton variant="ghost" title="Cancel" onPress={() => setEditing(false)} />
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  meta: { color: colors.textMuted },
  muted: { color: colors.textMuted },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { gap: 4 },
  rowLabel: { color: colors.textMuted, fontSize: 12 },
  rowValue: { color: colors.text, fontSize: 15, lineHeight: 20 },
  form: { gap: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchLabel: { flex: 1, color: colors.text, fontWeight: '700' },
  gallery: { gap: spacing.md },
  photo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.surface },
  photoPending: { backgroundColor: colors.surfaceAlt },
  photoNew: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
