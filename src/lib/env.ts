import Constants from 'expo-constants';

type Extra = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  YANDEX_MAPS_JS_API_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Прямые обращения к process.env — Metro заменяет их литералами при `expo export`.
 * Не сокращать через объект вида `process.env[name]` — подстановка может не сработать.
 */
const fromBundler = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  yandexMapsApiKey: process.env.EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY,
};

/** Сначала extra из app.config (после загрузки .env при сборке), затем литералы из бандлера. */
function pick(first: string | undefined, second: string | undefined): string | undefined {
  const a = first?.trim();
  if (a) return a;
  const b = second?.trim();
  if (b) return b;
  return undefined;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing env "${name}". Локально: .env (см. .env.example) и перезапуск. Веб/деплой: задайте EXPO_PUBLIC_* при сборке (export) или GitHub Secrets для CI.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', pick(extra.SUPABASE_URL, fromBundler.supabaseUrl)),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    pick(extra.SUPABASE_ANON_KEY, fromBundler.supabaseAnonKey),
  ),
  yandexMapsApiKey: required(
    'EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY',
    pick(extra.YANDEX_MAPS_JS_API_KEY, fromBundler.yandexMapsApiKey),
  ),
};
