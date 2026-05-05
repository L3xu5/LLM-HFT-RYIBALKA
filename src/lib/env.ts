import Constants from 'expo-constants';

type Extra = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  YANDEX_MAPS_JS_API_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing env "${name}". Заполните .env (см. .env.example) и перезапустите expo.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', extra.SUPABASE_URL),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', extra.SUPABASE_ANON_KEY),
  yandexMapsApiKey: required(
    'EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY',
    extra.YANDEX_MAPS_JS_API_KEY,
  ),
};
