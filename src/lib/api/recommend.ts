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
    return 'Не удалось достучаться до Edge Function (relay Supabase). Проверьте регион проекта и интернет.';
  }
  if (error instanceof FunctionsFetchError) {
    return 'Сеть: функция recommend-spot недоступна. Убедитесь, что выполнен deploy и секреты YandexGPT заданы (README).';
  }
  return error instanceof Error ? error.message : String(error);
}

export async function requestRecommendation(body: {
  lat: number;
  lng: number;
  radiusKm?: number;
}): Promise<RecommendationResponse> {
  /** Обновляет сессию на сервере Auth и даёт свежий JWT для Edge (важно на iOS/Android после фона). */
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('Войдите в аккаунт, чтобы получить подсказку от AI.');
  }

  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) {
    throw new Error('Сессия недоступна. Выйдите и войдите снова.');
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
