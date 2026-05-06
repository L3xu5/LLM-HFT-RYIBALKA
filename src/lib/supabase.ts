import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env } from './env';

/** On web, PKCE + AsyncStorage can break signUp/signIn; on native PKCE remains preferable. */
const isWeb = Platform.OS === 'web';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
    flowType: isWeb ? 'implicit' : 'pkce',
  },
});
