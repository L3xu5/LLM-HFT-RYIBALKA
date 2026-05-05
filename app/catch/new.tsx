import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { createCatch, uploadCatchPhotos } from '@/lib/api/catches';
import { type CatchFormValues, catchFormSchema } from '@/lib/catchForm';
import { queryKeys } from '@/lib/queryKeys';
import { colors, spacing } from '@/lib/theme';

type FormValues = CatchFormValues;

export default function NewCatchScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const lat = params.lat ? Number(params.lat) : NaN;
  const lng = params.lng ? Number(params.lng) : NaN;
  const coordsOk = useMemo(() => Number.isFinite(lat) && Number.isFinite(lng), [lat, lng]);

  const [photos, setPhotos] = useState<string[]>([]);

  const { control, handleSubmit } = useForm<FormValues>({
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

  async function pickPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Доступ к фото', 'Разрешите доступ к галерее в настройках.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (res.canceled) return;
    const uris = res.assets.map((a) => a.uri);
    setPhotos((prev) => [...prev, ...uris].slice(0, 8));
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((x) => x !== uri));
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!coordsOk) throw new Error('Нет координат');

      const weightRaw = values.weight_g?.trim();
      const weight = weightRaw ? Number(weightRaw) : undefined;
      if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
        throw new Error('Некорректный вес');
      }

      const row = await createCatch({
        lat,
        lng,
        fish_species: values.fish_species?.trim() ? values.fish_species.trim() : null,
        weight_g: weight ?? null,
        bait: values.bait?.trim() ? values.bait.trim() : null,
        gear: values.gear?.trim() ? values.gear.trim() : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        is_public: values.is_public,
      });

      if (photos.length > 0) {
        await uploadCatchPhotos(row.id, photos);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catches });
      router.replace('/(tabs)/map');
    },
    onError: (e) => Alert.alert('Ошибка', e instanceof Error ? e.message : String(e)),
  });

  if (!coordsOk) {
    return (
      <Screen>
        <Text style={styles.help}>
          Чтобы добавить улов, откройте вкладку «Карта», нажмите «＋» и выберите точку на водоёме.
        </Text>
        <PrimaryButton title="Перейти к карте" onPress={() => router.replace('/(tabs)/map')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.coords}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
          <Text style={styles.coordsHint}>Координаты выбраны на карте</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="fish_species"
            render={({ field }) => (
              <TextField label="Что поймали (вид)" value={field.value} onChangeText={field.onChange} />
            )}
          />

          <Controller
            control={control}
            name="weight_g"
            render={({ field }) => (
              <TextField
                label="Вес (граммы)"
                keyboardType="number-pad"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="bait"
            render={({ field }) => (
              <TextField label="Наживка / прикорм" value={field.value} onChangeText={field.onChange} />
            )}
          />

          <Controller
            control={control}
            name="gear"
            render={({ field }) => (
              <TextField label="Снасть" value={field.value} onChangeText={field.onChange} />
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextField
                label="Заметки"
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
                <Text style={styles.switchLabel}>Публичная точка</Text>
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  thumbColor={colors.primary}
                  trackColor={{ false: colors.border, true: colors.primaryDark }}
                />
              </View>
            )}
          />

          <PrimaryButton variant="ghost" title="Добавить фото" onPress={pickPhotos} />

          <View style={styles.photoGrid}>
            {photos.map((uri) => (
              <Pressable key={uri} onPress={() => removePhoto(uri)} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <Text style={styles.photoHint}>Нажмите, чтобы убрать</Text>
              </Pressable>
            ))}
          </View>

          <PrimaryButton
            title="Сохранить улов"
            loading={mutation.isPending}
            onPress={handleSubmit((v) => mutation.mutateAsync(v))}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { gap: spacing.xs },
  coords: { color: colors.text, fontWeight: '800', fontSize: 16 },
  coordsHint: { color: colors.textMuted, fontSize: 13 },
  form: { gap: spacing.md },
  help: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchLabel: { flex: 1, color: colors.text, fontWeight: '700' },
  photoGrid: { gap: spacing.md },
  photoWrap: { gap: spacing.xs },
  photo: { width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.surface },
  photoHint: { color: colors.textMuted, fontSize: 12 },
});
