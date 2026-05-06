import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  owner: 'lexasovsky',
  name: 'Fishing',
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
      /** Standard HTTPS/TLS only - simplifies App Store Connect encryption export answers. */
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Needed to show your location on the map and suggest nearby fishing spots.',
      NSCameraUsageDescription: 'Needed to take a photo of your catch.',
      NSPhotoLibraryUsageDescription: 'Needed to attach a catch photo from your gallery.',
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
          'Needed to show your location and suggest nearby fishing spots.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Needed to attach a catch photo.',
        cameraPermission: 'Needed to take a catch photo.',
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
