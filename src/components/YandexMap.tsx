import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import type { MapMarkerVm, MapViewport, YandexMapHandle } from '@/components/yandexMapTypes';
import { env } from '@/lib/env';
import { colors } from '@/lib/theme';
import { buildYandexMapHtml } from '@/map/yandexMapHtml';

export type { MapMarkerVm, MapViewport, YandexMapHandle };

type Props = {
  markers: MapMarkerVm[];
  pickMode?: boolean;
  onReady?: () => void;
  onMarkerPress: (id: string) => void;
  onMapPress?: (lat: number, lng: number) => void;
  onBridgeError?: (message: string) => void;
};

export const YandexMap = forwardRef<YandexMapHandle, Props>(function YandexMap(
  { markers, pickMode = false, onReady, onMarkerPress, onMapPress, onBridgeError },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [webReady, setWebReady] = useState(false);
  const readyCallbackFiredRef = useRef(false);
  const viewportPendingRef = useRef<{
    resolve: (v: MapViewport) => void;
    reject: (e: Error) => void;
  } | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const html = useMemo(() => buildYandexMapHtml(env.yandexMapsApiKey), []);

  const inject = useCallback((payload: Record<string, unknown>) => {
    const js = `window.__rnBridge(${JSON.stringify(payload)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  const pushMarkers = useCallback(() => {
    inject({
      action: 'setMarkers',
      items: markers.map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        title: m.title,
        subtitle: m.subtitle ?? '',
        color: m.color,
      })),
    });
  }, [inject, markers]);

  useEffect(() => {
    if (!webReady) return;
    pushMarkers();
  }, [pushMarkers, webReady]);

  useEffect(() => {
    if (!webReady) return;
    inject({ action: 'setPickMode', enabled: pickMode });
  }, [inject, pickMode, webReady]);

  useImperativeHandle(
    ref,
    () => ({
      setCamera(lat, lng, zoom) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        inject({ action: 'setCamera', lat, lng, zoom: zoom ?? 12 });
      },
      adjustZoom(delta) {
        if (!Number.isFinite(delta) || delta === 0) return;
        inject({ action: 'adjustZoom', delta });
      },
      getViewport() {
        return new Promise<MapViewport>((resolve, reject) => {
          const prev = viewportPendingRef.current;
          if (prev) prev.reject(new Error('Map viewport request was interrupted'));
          viewportPendingRef.current = { resolve, reject };
          if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
          viewportTimerRef.current = setTimeout(() => {
            viewportTimerRef.current = null;
            const p = viewportPendingRef.current;
            if (p) {
              viewportPendingRef.current = null;
              p.reject(new Error('Map did not respond'));
            }
          }, 4000);
          inject({ action: 'getViewport' });
        });
      },
    }),
    [inject],
  );

  const handleMsg = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data) as {
          type?: string;
          ok?: boolean;
          id?: string;
          lat?: number;
          lng?: number;
          zoom?: number;
          widthPx?: number;
          heightPx?: number;
          message?: string;
        };
        if (data.type === 'viewport') {
          if (viewportTimerRef.current) {
            clearTimeout(viewportTimerRef.current);
            viewportTimerRef.current = null;
          }
          const p = viewportPendingRef.current;
          viewportPendingRef.current = null;
          if (!p) return;
          if (data.ok === false || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
            p.reject(new Error('Map is not ready yet'));
            return;
          }
          const zm =
            typeof data.zoom === 'number' && Number.isFinite(data.zoom) ? data.zoom : 12;
          p.resolve({
            lat: data.lat,
            lng: data.lng,
            zoom: zm,
            widthPx:
              typeof data.widthPx === 'number' && Number.isFinite(data.widthPx)
                ? data.widthPx
                : undefined,
            heightPx:
              typeof data.heightPx === 'number' && Number.isFinite(data.heightPx)
                ? data.heightPx
                : undefined,
          });
          return;
        }
        if (data.type === 'ready') {
          setWebReady(true);
          if (!readyCallbackFiredRef.current) {
            readyCallbackFiredRef.current = true;
            onReady?.();
          }
          /** Repeated ready after WebView document reload: webReady is already true, so markers effect will not rerun. */
          pushMarkers();
          inject({ action: 'setPickMode', enabled: pickMode });
          return;
        }
        if (data.type === 'markerPress' && data.id) {
          onMarkerPress(data.id);
          return;
        }
        if (data.type === 'mapPress' && typeof data.lat === 'number' && typeof data.lng === 'number') {
          onMapPress?.(data.lat, data.lng);
          return;
        }
        if (data.type === 'error') {
          onBridgeError?.(data.message ?? 'unknown map error');
        }
      } catch {
        // ignore malformed messages
      }
    },
    [inject, onBridgeError, onMapPress, onMarkerPress, onReady, pickMode, pushMarkers],
  );

  /** Without baseUrl WKWebView uses "about:blank"; Yandex blocks script by Referrer. localhost matches key settings. */
  const webSource = useMemo(() => ({ html, baseUrl: 'http://localhost:8081/' }), [html]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={webSource}
        style={styles.web}
        onMessage={handleMsg}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        setSupportMultipleWindows={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
});
