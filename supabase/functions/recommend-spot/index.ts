import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Секреты: классические `YANDEX_*` или алиасы `YANDEX_CLOUD_*` из кабинета Yandex Cloud. */
function resolveYandexEnv(): { apiKey: string; folderId: string; modelUri: string } | null {
  const apiKey = (
    Deno.env.get('YANDEX_GPT_API_KEY') ??
    Deno.env.get('YANDEX_CLOUD_API_KEY') ??
    ''
  ).trim();
  const folderId = (
    Deno.env.get('YANDEX_FOLDER_ID') ??
    Deno.env.get('YANDEX_CLOUD_FOLDER') ??
    ''
  ).trim();

  if (!apiKey || !folderId) return null;

  const uriExplicit = (
    Deno.env.get('YANDEX_MODEL_URI') ??
    Deno.env.get('YANDEX_CLOUD_MODEL_URI') ??
    ''
  ).trim();
  const modelTail = (Deno.env.get('YANDEX_CLOUD_MODEL') ?? '').trim();

  let modelUri = '';
  if (uriExplicit) {
    modelUri = uriExplicit.startsWith('gpt://')
      ? uriExplicit
      : `gpt://${folderId}/${uriExplicit.replace(/^\//, '')}`;
  } else if (modelTail) {
    modelUri = modelTail.startsWith('gpt://')
      ? modelTail
      : `gpt://${folderId}/${modelTail.replace(/^\//, '')}`;
  } else {
    modelUri = `gpt://${folderId}/yandexgpt-lite/latest`;
  }

  return { apiKey, folderId, modelUri };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1]!.trim() : trimmed;
    return JSON.parse(candidate);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Model did not return JSON');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return json({ error: 'Missing Authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Missing Supabase env' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => null)) as
      | { lat?: unknown; lng?: unknown; radiusKm?: unknown }
      | null;

    const lat = typeof body?.lat === 'number' ? body.lat : Number(body?.lat);
    const lng = typeof body?.lng === 'number' ? body.lng : Number(body?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: 'lat/lng required' }, 400);
    }

    const radiusKmRaw = body?.radiusKm;
    const radiusKm =
      typeof radiusKmRaw === 'number'
        ? radiusKmRaw
        : typeof radiusKmRaw === 'string'
          ? Number(radiusKmRaw)
          : 120;

    const safeRadius = Number.isFinite(radiusKm) ? Math.min(Math.max(radiusKm, 5), 400) : 120;

    const { data: catches, error: catchesErr } = await supabase
      .from('catches')
      .select('id, lat, lng, fish_species, bait, gear, notes, caught_at, is_public, user_id')
      .order('caught_at', { ascending: false })
      .limit(600);

    if (catchesErr) throw catchesErr;

    const filtered = (catches ?? [])
      .map((c) => ({
        ...c,
        distanceKm: haversineKm(lat, lng, c.lat, c.lng),
      }))
      .filter((c) => c.distanceKm <= safeRadius)
      .slice(0, 140);

    const summaryLines = filtered.map((c) => {
      const mine = c.user_id === user.id ? ' (мой)' : '';
      const species = c.fish_species ? String(c.fish_species) : 'не указано';
      const bait = c.bait ? `, наживка: ${c.bait}` : '';
      const gear = c.gear ? `, снасть: ${c.gear}` : '';
      return `- ${species}${mine} @ ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} (${c.distanceKm.toFixed(
        1,
      )}км)${bait}${gear}`;
    });

    const prompt = [
      `Центр области карты, которую смотрит пользователь: lat=${lat}, lng=${lng}.`,
      `Радиус анализа (приблизительно видимая область карты): ${safeRadius} км.`,
      '',
      summaryLines.length
        ? 'Уловы в этом радиусе (публичные и ваши приватные):'
        : 'В базе пока нет доступных уловов в этом радиусе — опирайся на географию региона и сезон.',
      summaryLines.length ? summaryLines.join('\n') : '',
      '',
      'Верни ТОЛЬКО JSON без Markdown по схеме:',
      '{"lat": number, "lng": number, "reason": string, "suggested_bait": string | null, "suggested_species": string | null}',
      '',
      'Требования:',
      `- lat/lng: реалистичная точка у воды в пределах этой видимой области (ориентир ~${safeRadius} км от центра экрана карты).`,
      '- Если данных мало — всё равно предложи координаты и честно объясни допущения.',
      '- reason: 3-7 предложений по-русски.',
    ].join('\n');

    const yx = resolveYandexEnv();
    if (!yx) {
      return json(
        {
          error:
            'Нет ключей YandexGPT: задайте supabase secrets для YANDEX_GPT_API_KEY + YANDEX_FOLDER_ID (или YANDEX_CLOUD_API_KEY + YANDEX_CLOUD_FOLDER), опционально YANDEX_CLOUD_MODEL или YANDEX_MODEL_URI.',
        },
        500,
      );
    }

    const { apiKey, folderId, modelUri } = yx;

    const completionRes = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Api-Key ${apiKey}`,
          'x-folder-id': folderId,
        },
        body: JSON.stringify({
          modelUri,
          completionOptions: {
            stream: false,
            temperature: 0.25,
            maxTokens: 1200,
          },
          messages: [
            {
              role: 'system',
              text: 'Ты эксперт по рыбалке. Отвечай строго одним JSON-объектом без Markdown и без текста вокруг.',
            },
            { role: 'user', text: prompt },
          ],
        }),
      },
    );

    const rawCompletion = await completionRes.text();
    let completionJson: Record<string, unknown> | null = null;
    try {
      completionJson = JSON.parse(rawCompletion) as Record<string, unknown>;
    } catch {
      completionJson = null;
    }

    if (!completionRes.ok) {
      return json(
        { error: `YandexGPT HTTP ${completionRes.status}: ${rawCompletion.slice(0, 1500)}` },
        502,
      );
    }

    if (completionJson && 'error' in completionJson) {
      return json({ error: `YandexGPT: ${JSON.stringify(completionJson.error)}` }, 502);
    }

    const alt0 = completionJson?.result?.alternatives?.[0] as
      | { message?: { text?: string }; text?: string }
      | undefined;
    const text = alt0?.message?.text ?? alt0?.text ?? '';

    if (!String(text).trim()) {
      return json(
        { error: `Пустой ответ модели (проверьте YANDEX_MODEL_URI и доступ к Foundation Models): ${rawCompletion.slice(0, 1200)}` },
        502,
      );
    }

    const parsed = extractJson(String(text)) as Record<string, unknown>;

    const outLat = Number(parsed.lat);
    const outLng = Number(parsed.lng);
    const reason = String(parsed.reason ?? '').trim();
    const suggested_bait =
      parsed.suggested_bait === null || parsed.suggested_bait === undefined
        ? null
        : String(parsed.suggested_bait);
    const suggested_species =
      parsed.suggested_species === null || parsed.suggested_species === undefined
        ? null
        : String(parsed.suggested_species);

    if (!Number.isFinite(outLat) || !Number.isFinite(outLng) || !reason) {
      throw new Error('Invalid model JSON');
    }

    return json(
      {
        lat: outLat,
        lng: outLng,
        reason,
        suggested_bait,
        suggested_species,
      },
      200,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
