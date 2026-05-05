import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  owner: 'lexasovsky',
  name: 'Рыбалка',
  slug: 'rybalka',
  scheme: 'rybalka',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.rybalka.app',
    infoPlist: {
      /** Только стандартное HTTPS/TLS — упрощает ответ в App Store Connect (encryption export). */
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Нужно для показа вашего положения на карте и подбора ближайших мест рыбалки.',
      NSCameraUsageDescription: 'Нужно, чтобы сфотографировать улов.',
      NSPhotoLibraryUsageDescription: 'Нужно, чтобы прикрепить фото улова из галереи.',
    },
  },
  android: {
    package: 'com.rybalka.app',
    adaptiveIcon: {
      backgroundColor: '#0b3d2e',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    './plugins/withFmtXcode16Fix',
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Нужно для показа вашего положения и подбора ближайших мест рыбалки.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Нужно, чтобы прикрепить фото улова.',
        cameraPermission: 'Нужно, чтобы сфотографировать улов.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'd1f7f053-089c-44b0-930e-1dd58c7fe4af',
    },
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    YANDEX_MAPS_JS_API_KEY: process.env.EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY,
  },
};

export default config;
