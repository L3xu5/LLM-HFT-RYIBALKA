import type { RecommendationResponse } from '@/types/catch';

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const RETRY_DELAY_MS = 900;
const INVOKE_TIMEOUT_MS = Platform.OS === 'web' ? 180_000 : 120_000;

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

function shouldRetryInvokeError(error: unknown): boolean {
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) return true;
  const name =
    typeof error === 'object' && error && 'name' in error ? String((error as { name?: unknown }).name) : '';
  return name === 'FunctionsFetchError' || name === 'FunctionsRelayError';
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRecommendationPayload(data: unknown): RecommendationResponse {
  const obj = (data ?? {}) as Record<string, unknown>;
  const diagnostics =
    obj.diagnostics && typeof obj.diagnostics === 'object'
      ? (obj.diagnostics as RecommendationResponse['diagnostics'])
      : undefined;
  const sourceSet = new Set<string>();
  if (Array.isArray(obj.sources)) {
    for (const s of obj.sources) {
      const value = String(s ?? '').trim().toLowerCase();
      if (value) sourceSet.add(value);
    }
  }
  for (const a of diagnostics?.attempts ?? []) {
    if (a?.source === 'overpass' || a?.source === 'nominatim') {
      sourceSet.add(a.source);
    }
  }
  const sources = sourceSet.size > 0 ? [...sourceSet] : undefined;

  return {
    lat: Number(obj.lat),
    lng: Number(obj.lng),
    reason: String(obj.reason ?? ''),
    suggested_bait:
      obj.suggested_bait === null || obj.suggested_bait === undefined
        ? null
        : String(obj.suggested_bait),
    suggested_species:
      obj.suggested_species === null || obj.suggested_species === undefined
        ? null
        : String(obj.suggested_species),
    confidence: typeof obj.confidence === 'number' ? obj.confidence : undefined,
    assumptions: Array.isArray(obj.assumptions)
      ? obj.assumptions.map((x) => String(x)).filter((x) => x.trim().length > 0)
      : undefined,
    nearby_evidence: Array.isArray(obj.nearby_evidence)
      ? obj.nearby_evidence.map((x) => String(x)).filter((x) => x.trim().length > 0)
      : undefined,
    diagnostics,
    sources,
  };
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

  let data: unknown = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await supabase.functions.invoke('recommend-spot', {
      body,
      timeout: INVOKE_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    data = out.data;
    if (!out.error) {
      lastError = null;
      break;
    }
    lastError = out.error;
    if (!shouldRetryInvokeError(out.error) || attempt === 1) {
      break;
    }
    await delay(RETRY_DELAY_MS);
  }
  if (lastError) {
    throw new Error(await messageFromInvokeError(lastError));
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error?: unknown }).error ?? 'Edge Function error'));
  }

  return normalizeRecommendationPayload(data);
}
