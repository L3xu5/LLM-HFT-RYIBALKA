describe('env', () => {
  it('бросает если нет переменных в expo extra', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: { extra: {} },
        },
      }));
      expect(() => require('@/lib/env')).toThrow(/Missing env/);
    });
  });

  it('читает значения из expo extra', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              SUPABASE_URL: 'https://abc.supabase.co',
              SUPABASE_ANON_KEY: 'pk_test',
              YANDEX_MAPS_JS_API_KEY: 'map-key',
            },
          },
        },
      }));
      const { env } = require('@/lib/env') as typeof import('@/lib/env');
      expect(env.supabaseUrl).toBe('https://abc.supabase.co');
      expect(env.supabaseAnonKey).toBe('pk_test');
      expect(env.yandexMapsApiKey).toBe('map-key');
    });
  });
});
