import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';

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

function finiteDim(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  const r = Math.floor(x);
  if (!Number.isFinite(r) || r < 2) return fallback;
  return r;
}

/**
 * Как в нативном WebView: скрипт api-maps грузится **внутри iframe** (`useParentWindowApi: false`).
 * Вариант с `parent.ymaps3` ломается в браузерах (srcdoc / sandbox / порядок загрузки).
 */
export const YandexMap = forwardRef<YandexMapHandle, Props>(function YandexMap(
  { markers, pickMode = false, onReady, onMarkerPress, onMapPress, onBridgeError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { width: winW, height: winH } = useWindowDimensions();
  const [layoutBox, setLayoutBox] = useState({ w: 0, h: 0 });
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.round(Number(width) || 0);
    const h = Math.round(Number(height) || 0);
    setLayoutBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  /** На web вкладка ниже хедера; вычитаем типичную высоту tab bar, если layout ещё не пришёл. */
  const tabBarGuess = 56;
  const innerW =
    typeof window !== 'undefined' ? window.innerWidth : 375;
  const innerH =
    typeof window !== 'undefined' ? window.innerHeight : 667;
  const iw = layoutBox.w >= 2 ? layoutBox.w : finiteDim(winW, innerW);
  const ih =
    layoutBox.h >= 2
      ? layoutBox.h
      : finiteDim(finiteDim(winH, innerH) - tabBarGuess, 400);

  const [webReady, setWebReady] = useState(false);
  const readyCallbackFiredRef = useRef(false);
  const viewportPendingRef = useRef<{
    resolve: (v: MapViewport) => void;
    reject: (e: Error) => void;
  } | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const html = useMemo(() => buildYandexMapHtml(env.yandexMapsApiKey, { useParentWindowApi: false }), []);

  useEffect(() => {
    setWebReady(false);
    readyCallbackFiredRef.current = false;
  }, [html]);

  const inject = useCallback((payload: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow as (Window & { __rnBridge?: (msg: Record<string, unknown>) => void }) | null;
    win?.__rnBridge?.(payload);
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
          if (prev) prev.reject(new Error('Запрос вида карты прерван'));
          viewportPendingRef.current = { resolve, reject };
          if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
          viewportTimerRef.current = setTimeout(() => {
            viewportTimerRef.current = null;
            const p = viewportPendingRef.current;
            if (p) {
              viewportPendingRef.current = null;
              p.reject(new Error('Карта не ответила'));
            }
          }, 4000);
          inject({ action: 'getViewport' });
        });
      },
    }),
    [inject],
  );

  const handleMsg = useCallback(
    (raw: string) => {
      try {
        const data = JSON.parse(raw) as {
          type?: string;
          ok?: boolean;
          id?: string;
          lat?: number;
          lng?: number;
          zoom?: number;
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
            p.reject(new Error('Карта ещё не готова'));
            return;
          }
          const zm =
            typeof data.zoom === 'number' && Number.isFinite(data.zoom) ? data.zoom : 12;
          p.resolve({ lat: data.lat, lng: data.lng, zoom: zm });
          return;
        }
        if (data.type === 'ready') {
          setWebReady(true);
          if (!readyCallbackFiredRef.current) {
            readyCallbackFiredRef.current = true;
            onReady?.();
          }
          /** Повторный ready после перезагрузки iframe: иначе маркеры не уходят в новый документ. */
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

  useEffect(() => {
    function onWindowMessage(ev: MessageEvent) {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const raw = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data);
      handleMsg(raw);
    }

    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [handleMsg]);

  useEffect(() => {
    const cw = iframeRef.current?.contentWindow;
    if (!cw) return;
    try {
      cw.postMessage(JSON.stringify({ type: 'rnMapViewport', w: iw, h: ih }), '*');
    } catch {
      // ignore
    }
  }, [iw, ih, html]);

  return (
    <View style={styles.fill}>
      <View style={styles.mapFrame} onLayout={onContainerLayout}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title="Yandex Map"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            borderStyle: 'solid',
            borderWidth: 0,
            borderColor: 'transparent',
            backgroundColor: colors.bg,
          }}
          referrerPolicy="origin-when-cross-origin"
          onLoad={() => {
            const send = () => {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ type: 'rnMapViewport', w: iw, h: ih }),
                  '*',
                );
              } catch {
                /* ignore */
              }
            };
            send();
            requestAnimationFrame(() => requestAnimationFrame(send));
          }}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 0,
    backgroundColor: colors.bg,
  },
  mapFrame: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
