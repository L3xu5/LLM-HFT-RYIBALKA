import Constants from 'expo-constants';

type Extra = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  YANDEX_MAPS_JS_API_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** `extra` из app.config; на web export иногда пусто — тогда Metro подставляет `process.env.EXPO_PUBLIC_*` в бандл. */
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
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    pick(extra.SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_URL),
  ),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    pick(extra.SUPABASE_ANON_KEY, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  ),
  yandexMapsApiKey: required(
    'EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY',
    pick(extra.YANDEX_MAPS_JS_API_KEY, process.env.EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY),
  ),
};
