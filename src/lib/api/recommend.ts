import type { RecommendationResponse } from '@/types/catch';

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

async function messageFromInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    try {
      const payload = await res.clone().json();
      if (payload && typeof payload === 'object' && 'error' in payload) {
        return String((payload as { error: unknown }).error);
      }
    } catch {
      try {
        const text = await res.clone().text();
        if (text.trim()) return text.trim().slice(0, 800);
      } catch {
        /* ignore */
      }
    }
    return `Edge Function: HTTP ${res.status}`;
  }
  if (error instanceof FunctionsRelayError) {
    return 'Could not reach the Edge Function (Supabase relay). Check project region and internet connection.';
  }
  if (error instanceof FunctionsFetchError) {
    return 'Network error: recommend-spot is unavailable. Ensure it is deployed and YandexGPT secrets are set (README).';
  }
  return error instanceof Error ? error.message : String(error);
}

export async function requestRecommendation(body: {
  lat: number;
  lng: number;
  radiusKm?: number;
}): Promise<RecommendationResponse> {
  /** Refreshes Auth server session and gets a fresh JWT for Edge (important on iOS/Android after backgrounding). */
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('Sign in to get an AI recommendation.');
  }

  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) {
    throw new Error('Session is unavailable. Sign out and sign in again.');
  }

  const { data, error } = await supabase.functions.invoke('recommend-spot', {
    body,
    timeout: 120_000,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(await messageFromInvokeError(error));
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error?: unknown }).error ?? 'Edge Function error'));
  }

  return data as RecommendationResponse;
}
