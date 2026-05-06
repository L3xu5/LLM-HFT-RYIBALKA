import Constants from 'expo-constants';

type Extra = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  YANDEX_MAPS_JS_API_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Direct `process.env` access is required because Metro inlines literals during `expo export`.
 * Do not rewrite this into `process.env[name]` access, or replacement may fail.
 */
const fromBundler = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  yandexMapsApiKey: process.env.EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY,
};

/** Prefer `extra` from app.config first (after .env load), then bundler literals. */
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
      `Missing env "${name}". Local: configure .env (see .env.example) and restart. Web/deploy: pass EXPO_PUBLIC_* at build/export time or use GitHub Secrets in CI.`,
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
