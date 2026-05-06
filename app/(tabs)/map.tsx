import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { RedRecommendButton } from '@/components/RedRecommendButton';
import { YandexMap, type MapMarkerVm, type YandexMapHandle } from '@/components/YandexMap';
import { fetchCatches } from '@/lib/api/catches';
import { requestRecommendation } from '@/lib/api/recommend';
import { useAuth } from '@/lib/auth';
import { radiusKmForMapViewport } from '@/lib/mapViewport';
import { queryKeys } from '@/lib/queryKeys';
import { colors, radius, spacing } from '@/lib/theme';
import type { RecommendationResponse } from '@/types/catch';

export default function MapScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const mapRef = useRef<YandexMapHandle>(null);
  /** One initial GPS centering per screen; repeated `ready`/resize must not move camera (including after zoom). */
  const initialGpsCenterDoneRef = useRef(false);

  const [pickMode, setPickMode] = useState(false);
  const [rec, setRec] = useState<RecommendationResponse | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);

  const { data: catches = [] } = useQuery({
    queryKey: queryKeys.catches,
    queryFn: fetchCatches,
  });

  const markers = useMemo(() => {
    const uid = session?.user.id;
    const items: MapMarkerVm[] = catches.map((c) => ({
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      title: c.fish_species?.trim() ? (c.fish_species as string) : 'Catch',
      subtitle: c.user_id === uid ? 'My catch' : (c.author_name ?? 'Angler'),
      color: c.user_id === uid ? 'green' : 'blue',
    }));
    if (rec) {
      items.push({
        id: '__rec__',
        lat: rec.lat,
        lng: rec.lng,
        title: 'Where to go?',
        subtitle: rec.suggested_bait ? `Bait: ${rec.suggested_bait}` : undefined,
        color: 'orange',
      });
    }
    return items;
  }, [catches, rec, session?.user.id]);

  const centerOnUserOnce = useCallback(async () => {
    if (initialGpsCenterDoneRef.current) return;
    initialGpsCenterDoneRef.current = true;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      mapRef.current?.setCamera(lat, lng, 11);
    } catch {
      /* geolocation unavailable — keep default map center */
    }
  }, []);

  const onMapReady = useCallback(() => {
    const run = () => void centerOnUserOnce();
    if (Platform.OS === 'web') {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      run();
    }
  }, [centerOnUserOnce]);

  async function handleRecommend() {
    try {
      setLoadingRec(true);
      let lat: number;
      let lng: number;
      let zoom = 12;
      let viewportWidthPx: number | undefined;
      let viewportHeightPx: number | undefined;

      try {
        const vp = await mapRef.current?.getViewport();
        if (!vp || !Number.isFinite(vp.lat) || !Number.isFinite(vp.lng)) {
          throw new Error('no viewport');
        }
        lat = vp.lat;
        lng = vp.lng;
        zoom = Number.isFinite(vp.zoom) ? vp.zoom : 12;
        viewportWidthPx = Number.isFinite(vp.widthPx) ? vp.widthPx : undefined;
        viewportHeightPx = Number.isFinite(vp.heightPx) ? vp.heightPx : undefined;
      } catch {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Map center',
            'Wait for map load or allow geolocation first, then we can suggest a nearby spot.',
          );
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        zoom = 11;
      }

      const radiusFromViewport = radiusKmForMapViewport(
        zoom,
        lat,
        viewportWidthPx,
        viewportHeightPx,
      );
      const result = await requestRecommendation({
        lat,
        lng,
        radiusKm: radiusFromViewport,
      });
      setRec(result);
      setRecOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Recommendation request failed: ${msg}`);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoadingRec(false);
    }
  }

  function onMarkerPress(id: string) {
    if (id === '__rec__') {
      setRecOpen(true);
      return;
    }
    router.push(`/catch/${id}`);
  }

  function onMapPress(lat: number, lng: number) {
    if (!pickMode) return;
    setPickMode(false);
    router.push({ pathname: '/catch/new', params: { lat: String(lat), lng: String(lng) } });
  }

  return (
    <View style={styles.root}>
      <YandexMap
        ref={mapRef}
        markers={markers}
        pickMode={pickMode}
        onReady={onMapReady}
        onMarkerPress={onMarkerPress}
        onMapPress={onMapPress}
      />

      {pickMode ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Select a point on the map</Text>
          <Pressable hitSlop={8} onPress={() => setPickMode(false)}>
            <Text style={styles.bannerCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.zoomStack, styles.pointerBoxNone]}>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => mapRef.current?.adjustZoom(1)}
          accessibilityRole="button"
          accessibilityLabel="Zoom in map"
        >
          <Text style={styles.zoomBtnText}>＋</Text>
        </Pressable>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => mapRef.current?.adjustZoom(-1)}
          accessibilityRole="button"
          accessibilityLabel="Zoom out map"
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </Pressable>
      </View>

      <Pressable style={styles.addFab} onPress={() => setPickMode(true)} accessibilityRole="button">
        <Text style={styles.addFabText}>＋</Text>
      </Pressable>

      <View style={[styles.redWrap, styles.pointerBoxNone]}>
        <RedRecommendButton loading={loadingRec} onPress={handleRecommend} />
      </View>

      <Modal visible={recOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setRecOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Where to go?</Text>
            <Text style={styles.sheetBody}>{rec?.reason ?? ''}</Text>
            {rec?.sources?.length ? (
              <Text style={styles.sheetMeta}>Sources: {rec.sources.join(', ')}</Text>
            ) : null}
            {rec?.nearby_evidence?.length ? (
              <Text style={styles.sheetMeta}>Evidence: {rec.nearby_evidence.join(' | ')}</Text>
            ) : null}
            {rec?.suggested_bait ? (
              <Text style={styles.sheetMeta}>Bait: {rec.suggested_bait}</Text>
            ) : null}
            {rec?.suggested_species ? (
              <Text style={styles.sheetMeta}>Fish: {rec.suggested_species}</Text>
            ) : null}
            <Pressable style={styles.sheetClose} onPress={() => setRecOpen(false)}>
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Keep no minHeight: 100vh on web, otherwise absolute bottom controls slide under tab bar. */
  root: { flex: 1, width: '100%', backgroundColor: colors.bg },
  banner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    elevation: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bannerText: { flex: 1, color: colors.text, fontSize: 14 },
  bannerCancel: { color: colors.link, fontWeight: '700' },
  zoomStack: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 182,
    gap: spacing.sm,
    zIndex: 100,
    elevation: 100,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomBtnText: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: -1 },
  addFab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 112,
    zIndex: 100,
    elevation: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  addFabText: { color: '#fff', fontSize: 30, fontWeight: '700', marginTop: -2 },
  redWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    zIndex: 100,
    elevation: 100,
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sheetBody: { color: colors.text, fontSize: 15, lineHeight: 22 },
  sheetMeta: { color: colors.textMuted, fontSize: 14 },
  sheetClose: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  sheetCloseText: { color: colors.text, fontWeight: '700' },
});
