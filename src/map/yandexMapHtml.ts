/**
 * Self-contained HTML bundle for Yandex Maps JS API v3 inside WebView.
 * API key is interpolated server-side in RN before loading WebView.
 *
 * Bridge contract:
 * - Web → RN: window.ReactNativeWebView.postMessage(JSON.stringify({ type, ... }))
 * - RN → Web: injectJavaScript calling window.__rnBridge(payloadObject)
 *
 * Важно: глобальный `ymaps3` появляется только после выполнения внешнего скрипта API.
 * Expo Web: скрипт api-maps в **родительском** окне (`useParentWindowApi: true`); iframe (`srcDoc`, не blob:) использует `parent.ymaps3`.
 * Инициализация карты после появления размера у `#app` (`scheduleBoot`), иначе тайлы с NaN.
 */
/** Версия пакета маркеров для registerCdn + jsdelivr (см. npm @yandex/ymaps3-default-ui-theme). */
export const YMAPS_DEFAULT_UI_THEME_VERSION = '0.0.24';

export function getYandexMapsApiScriptUrl(apiKey: string): string {
  return `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
}

export type BuildYandexMapHtmlOptions = {
  /**
   * true: не вставлять &lt;script src=api-maps&gt; внутри iframe — ждать `ymaps3` от `window.parent`
   * (его подгружает React на странице Expo Web).
   */
  useParentWindowApi?: boolean;
};

export function buildYandexMapHtml(apiKey: string, options?: BuildYandexMapHtmlOptions): string {
  const apiScriptUrl = getYandexMapsApiScriptUrl(apiKey);
  const apiScriptUrlJs = JSON.stringify(apiScriptUrl);
  const themePkgLine = JSON.stringify(
    `@yandex/ymaps3-default-ui-theme@${YMAPS_DEFAULT_UI_THEME_VERSION}`,
  );
  const themeCssHrefJs = JSON.stringify(
    `https://cdn.jsdelivr.net/npm/@yandex/ymaps3-default-ui-theme@${YMAPS_DEFAULT_UI_THEME_VERSION}/dist/esm/index.css`,
  );
  const useParentWindowApi = Boolean(options?.useParentWindowApi);
  const useParentFlagJs = useParentWindowApi ? 'true' : 'false';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="referrer" content="origin-when-cross-origin" />
  <script>
    (function () {
      try {
        if (typeof TouchEvent === 'undefined' && typeof window.MouseEvent !== 'undefined')
          window.TouchEvent = window.MouseEvent;
      } catch (e) {}
    })();
  </script>
  <link rel="stylesheet" href=${themeCssHrefJs} />
  <style>
    html, body, #app {
      width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background:#0b1620;
      min-height: 100vh;
      min-height: 100dvh;
    }
    .map-error {
      color:#e9f1f7; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;
      padding:16px; font-size:14px;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    (function () {
      var USE_PARENT_WINDOW_API = ${useParentFlagJs};

      function post(payload) {
        try {
          var s = JSON.stringify(payload);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(s);
          }
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(s, '*');
          }
        } catch (e) {}
      }

      function getApi() {
        if (window.ymaps3) return window.ymaps3;
        try {
          if (window.parent && window.parent !== window && window.parent.ymaps3) {
            return window.parent.ymaps3;
          }
        } catch (e) {}
        return null;
      }

      var map = null;
      /**
       * Текущий центр экрана и зум — держим в синхроне с картой через YMapListener.onUpdate.
       * У YMap нет стабильного map.location; без onUpdate после drag зум ± шёл к старому центру (дефолт/GPS).
       */
      var lastMapCenter = [37.617644, 55.755819];
      var lastMapZoom = 10;
      var YMapDefaultMarker = null;
      var markers = new Map();
      var pickMode = false;
      var clickListener = null;

      /** Размер области карты с родительской страницы Expo (onLayout + postMessage) — приоритет над innerWidth iframe. */
      var RN_VIEWPORT_W = 0;
      var RN_VIEWPORT_H = 0;

      /**
       * В iframe с blob цепочка height:100% часто даёт 0×0 → тайлы x/y NaN.
       * Не подменяем размер всем окном родителя — это ломает проекцию; ждём rnMapViewport или берём inner iframe.
       */
      function ensureMapContainerPixels() {
        var el = document.getElementById('app');
        if (!el) return;
        var vw = 0;
        var vh = 0;
        if (RN_VIEWPORT_W >= 2 && RN_VIEWPORT_H >= 2) {
          vw = RN_VIEWPORT_W;
          vh = RN_VIEWPORT_H;
        } else {
          vw = window.innerWidth || document.documentElement.clientWidth || 0;
          vh = window.innerHeight || document.documentElement.clientHeight || 0;
        }
        if (vw < 2 || vh < 2) {
          try {
            if (window.parent && window.parent !== window) {
              var pw = window.parent.innerWidth;
              var ph = window.parent.innerHeight;
              if (pw >= 2 && ph >= 2) {
                vw = pw;
                vh = ph;
              }
            }
          } catch (ePV) {}
        }
        if (vw < 2) vw = 375;
        if (vh < 2) vh = 667;
        el.style.width = vw + 'px';
        el.style.height = vh + 'px';
        document.documentElement.style.width = vw + 'px';
        document.documentElement.style.height = vh + 'px';
        document.body.style.width = vw + 'px';
        document.body.style.height = vh + 'px';
      }

      window.addEventListener('message', function (ev) {
        try {
          var raw = ev.data;
          if (typeof raw !== 'string') return;
          var data = JSON.parse(raw);
          if (!data || data.type !== 'rnMapViewport') return;
          var ww = Number(data.w);
          var hh = Number(data.h);
          if (!isFinite(ww) || !isFinite(hh) || ww < 2 || hh < 2) return;
          RN_VIEWPORT_W = ww;
          RN_VIEWPORT_H = hh;
          ensureMapContainerPixels();
          try {
            window.dispatchEvent(new Event('resize'));
          } catch (eRs) {}
        } catch (eMsg) {}
      });

      async function initMap() {
        try {
          ensureMapContainerPixels();

          var api = getApi();
          if (!api) {
            throw new Error('API карты не загрузился (нет ymaps3). Проверьте ключ и сеть.');
          }

          await api.ready;

          // Без registerCdn ymaps3.import не знает, откуда тянуть npm-пакет темы (ошибка «no loader»).
          if (api.import && typeof api.import.registerCdn === 'function') {
            api.import.registerCdn('https://cdn.jsdelivr.net/npm/{package}', [${themePkgLine}]);
          }

          var ymaps3Import = await api.import('@yandex/ymaps3-default-ui-theme');
          YMapDefaultMarker = ymaps3Import.YMapDefaultMarker;

          var YMap = api.YMap;
          var YMapDefaultSchemeLayer = api.YMapDefaultSchemeLayer;
          var YMapDefaultFeaturesLayer = api.YMapDefaultFeaturesLayer;
          var YMapListener = api.YMapListener;

          map = new YMap(
            document.getElementById('app'),
            {
              location: { center: [37.617644, 55.755819], zoom: 10 },
              showScaleInCopyrights: true,
            },
            [new YMapDefaultSchemeLayer({}), new YMapDefaultFeaturesLayer({})],
          );
          lastMapCenter = [37.617644, 55.755819];
          lastMapZoom = 10;

          function handleMapTap(obj, ev) {
            if (!pickMode) return;
            if (obj && obj.type) return;
            var evt = ev && ev.coordinates ? ev : obj && obj.coordinates ? obj : null;
            if (!evt || !evt.coordinates) return;
            var c = evt.coordinates;
            post({ type: 'mapPress', lat: c[1], lng: c[0] });
          }

          clickListener = new YMapListener({
            layer: 'any',
            onClick: handleMapTap,
            onFastClick: handleMapTap,
            onUpdate: function (ev) {
              try {
                var loc = ev && ev.location;
                if (!loc) return;
                if (loc.center && loc.center.length >= 2) {
                  var clng = Number(loc.center[0]);
                  var clat = Number(loc.center[1]);
                  if (isFinite(clng) && isFinite(clat)) {
                    lastMapCenter = [clng, clat];
                  }
                }
                if (typeof loc.zoom === 'number' && isFinite(loc.zoom)) {
                  lastMapZoom = loc.zoom;
                }
              } catch (eUpd) {}
            },
          });
          map.addChild(clickListener);

          /** После появления размера контейнера пересчитываем вьюпорт (иначе тайлы NaN до первого resize). */
          function nudgeResize() {
            try {
              window.dispatchEvent(new Event('resize'));
            } catch (eNudge) {}
          }
          requestAnimationFrame(nudgeResize);
          setTimeout(nudgeResize, 50);
          setTimeout(nudgeResize, 300);

          post({ type: 'ready' });
        } catch (e) {
          document.getElementById('app').innerHTML =
            '<div class="map-error">Не удалось загрузить карту: ' + String(e && e.message ? e.message : e) + '</div>';
          post({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      }

      /** Пока #app с нулевой высотой (iframe / RN Web), тайлы дают x/y NaN → 400 и ложный CORS. */
      function scheduleBoot() {
        var el = document.getElementById('app');
        if (!el) {
          void initMap();
          return;
        }

        var scheduled = false;
        function runInit() {
          if (scheduled) return;
          scheduled = true;
          if (ro) {
            try {
              ro.disconnect();
            } catch (eRo) {}
          }
          void initMap();
        }

        function sized() {
          var w = el.offsetWidth;
          var h = el.offsetHeight;
          return w >= 2 && h >= 2;
        }

        function hasParentViewport() {
          return RN_VIEWPORT_W >= 2 && RN_VIEWPORT_H >= 2;
        }

        /** Дождаться postMessage rnMapViewport от Expo (несколько кадров), иначе YMap строится с неверным viewport. */
        function canStartMap(attempts) {
          if (!sized()) return false;
          if (hasParentViewport()) return true;
          return attempts > 90;
        }

        var ro = null;
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(function () {
            /* attempts недоступен — только проверка размера; полный canStartMap в tick */
            if (sized() && hasParentViewport()) runInit();
          });
          try {
            ro.observe(el);
          } catch (eObs) {}
        }

        var attempts = 0;
        function tick() {
          attempts++;
          ensureMapContainerPixels();
          if (canStartMap(attempts)) {
            runInit();
            return;
          }
          if (attempts > 2400) {
            ensureMapContainerPixels();
            runInit();
            return;
          }
          requestAnimationFrame(tick);
        }

        if (sized() && hasParentViewport()) {
          runInit();
          return;
        }
        requestAnimationFrame(tick);
      }

      function clearMarkers() {
        if (!map) return;
        markers.forEach(function (m) {
          try {
            map.removeChild(m);
          } catch (e2) {}
        });
        markers.clear();
      }

      function setMarkers(items) {
        if (!map || !YMapDefaultMarker) return;
        clearMarkers();
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var mlng = Number(it.lng);
          var mlat = Number(it.lat);
          if (!isFinite(mlng) || !isFinite(mlat)) continue;
          var marker = new YMapDefaultMarker({
            coordinates: [mlng, mlat],
            title: it.title || '',
            subtitle: it.subtitle || '',
            color: it.color || 'blue',
            size: 'normal',
            iconName: 'fallback',
            onClick: (function (id) {
              return function () {
                post({ type: 'markerPress', id: id });
              };
            })(it.id),
          });
          markers.set(it.id, marker);
          map.addChild(marker);
        }
      }

      function setPickMode(enabled) {
        pickMode = !!enabled;
      }

      function setCamera(centerLng, centerLat, zoom) {
        if (!map) return;
        var lng = Number(centerLng);
        var lat = Number(centerLat);
        var z = Number(zoom);
        if (!isFinite(lng) || !isFinite(lat)) return;
        if (!isFinite(z) || z <= 0) z = 12;
        lastMapCenter = [lng, lat];
        lastMapZoom = z;
        map.setLocation({
          center: [lng, lat],
          zoom: z,
          duration: 400,
        });
      }

      function adjustZoom(delta) {
        if (!map) return;
        var d = Number(delta);
        if (!isFinite(d) || d === 0) return;
        var lng = lastMapCenter[0];
        var lat = lastMapCenter[1];
        var z = lastMapZoom;
        var nz = Math.min(19, Math.max(2, Math.round(z + d)));
        lastMapZoom = nz;
        map.setLocation({
          center: [lng, lat],
          zoom: nz,
          duration: 200,
        });
      }

      window.__rnBridge = function (msg) {
        try {
          if (!msg || !msg.action) return;

          if (msg.action === 'setMarkers') {
            setMarkers(msg.items || []);
          } else if (msg.action === 'setPickMode') {
            setPickMode(msg.enabled);
          } else if (msg.action === 'setCamera') {
            setCamera(msg.lng, msg.lat, msg.zoom);
          } else if (msg.action === 'adjustZoom') {
            adjustZoom(msg.delta);
          } else if (msg.action === 'getViewport') {
            if (!map) {
              post({ type: 'viewport', ok: false });
              return;
            }
            var vlng = lastMapCenter[0];
            var vlat = lastMapCenter[1];
            var vz = lastMapZoom;
            post({ type: 'viewport', ok: true, lat: vlat, lng: vlng, zoom: vz });
          } else if (msg.action === 'clearRecommendation') {
            if (markers.has('__rec__')) {
              try {
                map.removeChild(markers.get('__rec__'));
              } catch (e3) {}
              markers.delete('__rec__');
            }
          }
        } catch (e4) {
          post({ type: 'error', message: String(e4 && e4.message ? e4.message : e4) });
        }
      };

      function loadApiAndBoot() {
        if (getApi()) {
          scheduleBoot();
          return;
        }

        if (USE_PARENT_WINDOW_API) {
          var n = 0;
          var id = setInterval(function () {
            n++;
            if (getApi()) {
              clearInterval(id);
              scheduleBoot();
            } else if (n >= 400) {
              clearInterval(id);
              var appEl = document.getElementById('app');
              if (appEl) {
                appEl.innerHTML =
                  '<div class="map-error">Не дождались API карты от родительской страницы. Обновите страницу.</div>';
              }
              post({ type: 'error', message: 'parent ymaps3 timeout' });
            }
          }, 25);
          return;
        }

        var s = document.createElement('script');
        s.src = ${apiScriptUrlJs};
        s.async = true;
        s.referrerPolicy = 'origin-when-cross-origin';
        s.setAttribute('data-yandex-maps-api', 'v3');
        s.onload = function () {
          scheduleBoot();
        };
        s.onerror = function () {
          var app = document.getElementById('app');
          if (app) {
            app.innerHTML =
              '<div class="map-error">Не удалось загрузить скрипт Яндекс.Карт. В кабинете ключа: для JS API — HTTP Referer <b>localhost</b> и при необходимости <b>127.0.0.1</b>; для приложения в WebView — ограничение по <b>идентификатору iOS-пакета</b> (bundle id), например <b>com.rybalka.app</b>. Ограничение по IP для разработки оставьте пустым.</div>';
          }
          post({ type: 'error', message: 'script load failed' });
        };
        document.head.appendChild(s);
      }

      loadApiAndBoot();
    })();
  </script>
</body>
</html>`;
}
