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

/** Secrets: classic `YANDEX_*` names or `YANDEX_CLOUD_*` aliases from Yandex Cloud. */
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

function hasCyrillic(text: string): boolean {
  return /[А-Яа-яЁё]/.test(text);
}

function containsInternalPromptLeak(text: string): boolean {
  return /\b(GEO_CONTEXT|CATCH_STATS|CATCH_POINTS|MAP_VIEW|schema)\b/i.test(text);
}

function isGenericReason(text: string): boolean {
  return (
    /\b(common in this region|good fishing potential|relatively close|within the .* radius)\b/i.test(
      text,
    ) ||
    /\bknown fishing spots\b/i.test(text) ||
    /\b(good balance between proximity|exploration of new grounds|typically higher)\b/i.test(text) ||
    /\b(target species are likely|depending on fish behavior)\b/i.test(text)
  );
}

function removeInternalOrProcessPhrases(text: string): string {
  return text
    .replace(
      /\bThis recommendation is aligned to the nearest proven catch location\.?\s*/gi,
      '',
    )
    .replace(/\bThis point is returned as a best-effort estimate in the current map view\.?\s*/gi, '')
    .trim();
}

async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type GeoContext = {
  placeLabel: string | null;
  admin: string | null;
  country: string | null;
  waterObjectsCount: number;
  nearestWaterKm: number | null;
  nearestWaterName: string | null;
  waterKinds: string[];
};

type WaterPoint = {
  lat: number;
  lng: number;
  name: string | null;
  kind: string | null;
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

function topCounts(
  items: Array<string | null | undefined>,
  limit = 4,
): Array<{ value: string; count: number }> {
  const map = new Map<string, number>();
  for (const raw of items) {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

async function fetchGeoContext(lat: number, lng: number, radiusKm: number): Promise<GeoContext> {
  const out: GeoContext = {
    placeLabel: null,
    admin: null,
    country: null,
    waterObjectsCount: 0,
    nearestWaterKm: null,
    nearestWaterName: null,
    waterKinds: [],
  };

  // Reverse geocoding (best-effort only).
  try {
    const revUrl =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lng)}&zoom=12&accept-language=en`;
    const revRes = await fetchWithTimeout(revUrl, {
      headers: {
        'User-Agent': 'rybalka-edge-function/1.0',
      },
    }, 4_000);
    if (revRes.ok) {
      const rev = (await revRes.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const a = rev.address ?? {};
      out.placeLabel = rev.display_name?.trim() || null;
      out.admin = a.city ?? a.town ?? a.village ?? a.state ?? null;
      out.country = a.country ?? null;
    }
  } catch {
    // ignore: do not fail recommendation on external geo API
  }

  // Nearby water objects via Overpass API (best-effort only).
  try {
    const radiusM = Math.round(Math.min(Math.max(radiusKm * 1000, 1200), 20000));
    const q = [
      '[out:json][timeout:12];',
      '(',
      `  way(around:${radiusM},${lat},${lng})["natural"="water"];`,
      `  way(around:${radiusM},${lat},${lng})["waterway"];`,
      `  relation(around:${radiusM},${lat},${lng})["natural"="water"];`,
      `  relation(around:${radiusM},${lat},${lng})["waterway"];`,
      ');',
      'out center tags qt 40;',
    ].join('\n');
    const overpassRes = await postOverpassWithFailover(q, 7_000);
    if (overpassRes.ok) {
      const op = (await overpassRes.json()) as {
        elements?: Array<{
          lat?: number;
          lon?: number;
          center?: { lat?: number; lon?: number };
          tags?: Record<string, string>;
        }>;
      };
      const elements = op.elements ?? [];
      out.waterObjectsCount = elements.length;

      let nearest: { km: number; name: string | null; kind: string | null } | null = null;
      const kinds = new Map<string, number>();

      for (const e of elements) {
        const elLat = Number(e.lat ?? e.center?.lat);
        const elLng = Number(e.lon ?? e.center?.lon);
        if (!Number.isFinite(elLat) || !Number.isFinite(elLng)) continue;
        const km = haversineKm(lat, lng, elLat, elLng);
        const tags = e.tags ?? {};
        const name = tags.name?.trim() || null;
        const kind = tags.waterway?.trim() || tags.water?.trim() || tags.natural?.trim() || null;
        if (kind) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        if (!nearest || km < nearest.km) nearest = { km, name, kind };
      }

      if (nearest) {
        out.nearestWaterKm = Number(nearest.km.toFixed(2));
        out.nearestWaterName = nearest.name;
      }
      out.waterKinds = [...kinds.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);
    }
  } catch {
    // ignore: do not fail recommendation on external geo API
  }

  return out;
}

async function fetchNearbyWaterPoints(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<WaterPoint[]> {
  try {
    const radiusM = Math.round(Math.min(Math.max(radiusKm * 1000, 1200), 25000));
    const q = [
      '[out:json][timeout:12];',
      '(',
      `  node(around:${radiusM},${lat},${lng})["natural"="water"];`,
      `  node(around:${radiusM},${lat},${lng})["waterway"];`,
      `  way(around:${radiusM},${lat},${lng})["natural"="water"];`,
      `  way(around:${radiusM},${lat},${lng})["waterway"];`,
      `  way(around:${radiusM},${lat},${lng})["water"];`,
      `  relation(around:${radiusM},${lat},${lng})["natural"="water"];`,
      `  relation(around:${radiusM},${lat},${lng})["waterway"];`,
      `  relation(around:${radiusM},${lat},${lng})["water"];`,
      ');',
      'out center tags qt 120;',
    ].join('\n');
    const overpassRes = await postOverpassWithFailover(q, 7_000);
    if (!overpassRes.ok) return [];
    const op = (await overpassRes.json()) as {
      elements?: Array<{
        lat?: number;
        lon?: number;
        center?: { lat?: number; lon?: number };
        tags?: Record<string, string>;
      }>;
    };
    return (op.elements ?? [])
      .map((e) => {
        const elLat = Number(e.lat ?? e.center?.lat);
        const elLng = Number(e.lon ?? e.center?.lon);
        if (!Number.isFinite(elLat) || !Number.isFinite(elLng)) return null;
        const tags = e.tags ?? {};
        return {
          lat: elLat,
          lng: elLng,
          name: tags.name?.trim() || null,
          kind: tags.waterway?.trim() || tags.water?.trim() || tags.natural?.trim() || null,
        } as WaterPoint;
      })
      .filter((x): x is WaterPoint => !!x);
  } catch {
    return [];
  }
}

async function fetchNearbyWaterPointsNominatim(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<WaterPoint[]> {
  const words = ['river', 'lake', 'reservoir', 'pond', 'stream', 'canal', 'bay', 'water'];
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLat = Math.max(0.01, Math.min(3, radiusKm / 111));
  const dLon = Math.max(0.01, Math.min(3, radiusKm / (111 * cosLat)));
  const left = lng - dLon;
  const right = lng + dLon;
  const top = lat + dLat;
  const bottom = lat - dLat;
  const acc = new Map<string, WaterPoint>();

  await Promise.all(
    words.map(async (word) => {
      const url =
        'https://nominatim.openstreetmap.org/search' +
        `?q=${encodeURIComponent(word)}` +
        '&format=jsonv2&limit=30&bounded=1&addressdetails=0' +
        `&viewbox=${encodeURIComponent(`${left},${top},${right},${bottom}`)}`;
      try {
        const res = await fetchWithTimeout(
          url,
          {
            headers: {
              'User-Agent': 'rybalka-edge-function/1.0',
            },
          },
          5_000,
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          lat?: string;
          lon?: string;
          display_name?: string;
          type?: string;
        }>;
        for (const row of rows ?? []) {
          const pLat = Number(row.lat);
          const pLng = Number(row.lon);
          if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
          const key = `${pLat.toFixed(5)},${pLng.toFixed(5)}`;
          if (!acc.has(key)) {
            acc.set(key, {
              lat: pLat,
              lng: pLng,
              name: row.display_name?.trim() || null,
              kind: row.type?.trim() || word,
            });
          }
        }
      } catch {
        // ignore single-query failure
      }
    }),
  );

  return [...acc.values()];
}

async function postOverpassWithFailover(query: string, timeoutMs: number): Promise<Response> {
  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: query,
        },
        timeoutMs,
      );
      if (res.ok) return res;
      lastErr = new Error(`Overpass ${endpoint} returned HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('All Overpass endpoints failed');
}

async function discoverWaterPoints(params: {
  centerLat: number;
  centerLng: number;
  modelLat: number;
  modelLng: number;
  safeRadiusKm: number;
}): Promise<{
  points: WaterPoint[];
  diagnostics: {
    attempts: Array<{
      source: 'overpass' | 'nominatim';
      around: 'center' | 'model';
      radius_km: number;
      hits: number;
    }>;
  };
}> {
  const attempts: Array<{
    source: 'overpass' | 'nominatim';
    around: 'center' | 'model';
    radius_km: number;
    hits: number;
  }> =
    [];
  const all = new Map<string, WaterPoint>();
  const startedAt = Date.now();
  const timeBudgetMs = 28_000;
  const radii = [
    Math.max(5, Math.min(params.safeRadiusKm, 25)),
    Math.max(12, Math.min(Math.max(params.safeRadiusKm * 3, 12), 45)),
    Math.max(20, Math.min(Math.max(params.safeRadiusKm * 4, 20), 80)),
  ];

  const pushAll = (items: WaterPoint[]) => {
    for (const w of items) {
      const key = `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`;
      if (!all.has(key)) all.set(key, w);
    }
  };
  const runAttempt = async (
    source: 'overpass' | 'nominatim',
    around: 'center' | 'model',
    qLat: number,
    qLng: number,
    radius: number,
  ): Promise<{
    source: 'overpass' | 'nominatim';
    around: 'center' | 'model';
    radius_km: number;
    points: WaterPoint[];
  }> => {
    const points =
      source === 'overpass'
        ? await fetchNearbyWaterPoints(qLat, qLng, radius)
        : await fetchNearbyWaterPointsNominatim(qLat, qLng, radius);
    return { source, around, radius_km: radius, points };
  };

  for (let pass = 0; pass < 2; pass++) {
    const passScale = pass === 0 ? 1 : 1.55;
    for (const baseRadius of radii) {
      if (Date.now() - startedAt > timeBudgetMs) break;
      const radius = Math.min(120, Math.max(4, baseRadius * passScale));
      const jobs: Array<
        Promise<{
          source: 'overpass' | 'nominatim';
          around: 'center' | 'model';
          radius_km: number;
          points: WaterPoint[];
        }>
      > = [];
      jobs.push(runAttempt('overpass', 'center', params.centerLat, params.centerLng, radius));
      jobs.push(runAttempt('overpass', 'model', params.modelLat, params.modelLng, radius));
      jobs.push(runAttempt('nominatim', 'center', params.centerLat, params.centerLng, radius));
      jobs.push(runAttempt('nominatim', 'model', params.modelLat, params.modelLng, radius));
      const results = await Promise.all(jobs);
      for (const r of results) {
        const before = all.size;
        pushAll(r.points);
        attempts.push({
          source: r.source,
          around: r.around,
          radius_km: r.radius_km,
          hits: Math.max(0, all.size - before),
        });
      }
      if (Date.now() - startedAt > timeBudgetMs) break;

      if (all.size >= 12) break;
    }
    if (all.size >= 12) break;
    if (Date.now() - startedAt > timeBudgetMs) break;
  }

  return {
    points: [...all.values()],
    diagnostics: {
      attempts,
    },
  };
}

async function callYandexCompletion(params: {
  apiKey: string;
  folderId: string;
  modelUri: string;
  systemText: string;
  userText: string;
}): Promise<{ text: string; raw: string }> {
  const res = await fetchWithTimeout('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${params.apiKey}`,
      'x-folder-id': params.folderId,
    },
    body: JSON.stringify({
      modelUri: params.modelUri,
      completionOptions: {
        stream: false,
        temperature: 0.15,
        maxTokens: 1400,
      },
      messages: [
        { role: 'system', text: params.systemText },
        { role: 'user', text: params.userText },
      ],
    }),
  }, 45_000);

  const raw = await res.text();
  let jsonParsed: Record<string, unknown> | null = null;
  try {
    jsonParsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    jsonParsed = null;
  }

  if (!res.ok) {
    throw new Error(`YandexGPT HTTP ${res.status}: ${raw.slice(0, 1500)}`);
  }
  if (jsonParsed && 'error' in jsonParsed) {
    throw new Error(`YandexGPT: ${JSON.stringify(jsonParsed.error)}`);
  }

  const alt0 = jsonParsed?.result?.alternatives?.[0] as
    | { message?: { text?: string }; text?: string }
    | undefined;
  const text = String(alt0?.message?.text ?? alt0?.text ?? '').trim();
  if (!text) {
    throw new Error(`Empty model response: ${raw.slice(0, 1200)}`);
  }
  return { text, raw };
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

    const safeRadius = Number.isFinite(radiusKm) ? Math.min(Math.max(radiusKm, 0.4), 400) : 120;

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
      const mine = c.user_id === user.id ? ' (mine)' : '';
      const species = c.fish_species ? String(c.fish_species) : 'unspecified';
      const bait = c.bait ? `, bait: ${c.bait}` : '';
      const gear = c.gear ? `, tackle: ${c.gear}` : '';
      return `- ${species}${mine} @ ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} (${c.distanceKm.toFixed(
        1,
      )} km)${bait}${gear}`;
    });

    const mineCount = filtered.filter((c) => c.user_id === user.id).length;
    const topSpecies = topCounts(filtered.map((c) => c.fish_species), 4);
    const topBaits = topCounts(filtered.map((c) => c.bait), 4);
    const geo = await fetchGeoContext(lat, lng, safeRadius);

    const prompt = [
      'TASK: Recommend one realistic fishing point near water within the currently visible map area.',
      '',
      'MAP_VIEW:',
      JSON.stringify(
        {
          center: { lat, lng },
          radius_km: safeRadius,
        },
        null,
        2,
      ),
      '',
      'GEO_CONTEXT:',
      JSON.stringify(geo, null, 2),
      '',
      'CATCH_STATS:',
      JSON.stringify(
        {
          total_points_in_radius: filtered.length,
          my_points: mineCount,
          public_or_other_points: filtered.length - mineCount,
          top_species: topSpecies,
          top_baits: topBaits,
        },
        null,
        2,
      ),
      '',
      summaryLines.length
        ? 'CATCH_POINTS (public + your private points):'
        : 'CATCH_POINTS: no catches in this radius yet; rely on geography + seasonality assumptions.',
      summaryLines.length ? summaryLines.join('\n') : '',
      '',
      'Return ONLY JSON without Markdown using this schema:',
      '{"lat": number, "lng": number, "reason": string, "suggested_bait": string | null, "suggested_species": string | null, "confidence": number, "assumptions": string[], "nearby_evidence": string[]}',
      '',
      'Requirements:',
      `- lat/lng must be a realistic point near water and within roughly ~${safeRadius} km from center.`,
      '- Prefer a nearby NEW point (not exact duplicate of known catch coordinates) unless data is very sparse.',
      '- If data is sparse, still propose coordinates and explicitly say assumptions are used.',
      '- reason must be 4 short sentences max, user-facing, practical, and specific (no generic filler).',
      '- reason sentence structure: (1) why this exact spot; (2) target fish; (3) bait/tackle strategy; (4) best timing/risk note.',
      '- Mention species/bait ONLY if present in CATCH_STATS/CATCH_POINTS; otherwise use neutral wording ("local species", "natural bait").',
      '- Never mention internal labels like GEO_CONTEXT/CATCH_STATS/schema/model/fallback/water validation.',
      '- Avoid contradictory advice and avoid broad claims like "common in this region" unless supported by provided data.',
      '- confidence: 0..1 number.',
      '- nearby_evidence: exactly 3 concise bullets derived from provided input only.',
      '- assumptions: 1-3 concise assumptions, only when evidence is sparse.',
      '- If CATCH_POINTS are empty, set suggested_bait=null and suggested_species=null.',
      '- Output MUST be English only. If source terms are non-English, translate them to natural English.',
    ].join('\n');

    const yx = resolveYandexEnv();
    if (!yx) {
      return json(
        {
          error:
            'YandexGPT keys are missing: set supabase secrets for YANDEX_GPT_API_KEY + YANDEX_FOLDER_ID (or YANDEX_CLOUD_API_KEY + YANDEX_CLOUD_FOLDER), optionally YANDEX_CLOUD_MODEL or YANDEX_MODEL_URI.',
        },
        500,
      );
    }

    const { apiKey, folderId, modelUri } = yx;

    const firstPass = await callYandexCompletion({
      apiKey,
      folderId,
      modelUri,
      systemText:
        'You are a pragmatic fishing guide. Be concrete, concise, and evidence-grounded. Reply with exactly one JSON object only (no markdown, no extra text).',
      userText: prompt,
    });

    let parsed = extractJson(firstPass.text) as Record<string, unknown>;

    const outLat = Number(parsed.lat);
    const outLng = Number(parsed.lng);
    const reason = String(parsed.reason ?? '').trim();
    let suggested_bait =
      parsed.suggested_bait === null || parsed.suggested_bait === undefined
        ? null
        : String(parsed.suggested_bait);
    let suggested_species =
      parsed.suggested_species === null || parsed.suggested_species === undefined
        ? null
        : String(parsed.suggested_species);
    const confidenceRaw = Number(parsed.confidence);
    const confidence =
      Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : undefined;
    const assumptions = Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((x) => String(x)).filter((x) => x.trim().length > 0).slice(0, 8)
      : undefined;
    const nearbyEvidence = Array.isArray(parsed.nearby_evidence)
      ? parsed.nearby_evidence.map((x) => String(x)).filter((x) => x.trim().length > 0).slice(0, 8)
      : undefined;

    const needsCleanup =
      hasCyrillic(reason) ||
      hasCyrillic(String(suggested_bait ?? '')) ||
      hasCyrillic(String(suggested_species ?? '')) ||
      containsInternalPromptLeak(reason) ||
      isGenericReason(reason);

    if (needsCleanup) {
      const rewritePrompt = [
        'Rewrite the following recommendation JSON.',
        'Rules:',
        '- Keep lat/lng unchanged.',
        '- Keep meaning and evidence.',
        '- Translate all fields to natural English.',
        '- Remove internal technical references (GEO_CONTEXT/CATCH_STATS/schema/etc).',
        '- Make reason concrete and non-generic; no filler statements.',
        '- Keep reason to max 4 short sentences with this order: spot rationale -> fish -> bait/tackle -> timing/risk.',
        '- Return JSON only with the same keys.',
        '',
        JSON.stringify(parsed),
      ].join('\n');
      const rewrite = await callYandexCompletion({
        apiKey,
        folderId,
        modelUri,
        systemText:
          'You rewrite recommendation JSON into clean English. Return only one JSON object and preserve coordinates.',
        userText: rewritePrompt,
      });
      parsed = extractJson(rewrite.text) as Record<string, unknown>;
    }

    let finalLat = Number(parsed.lat);
    let finalLng = Number(parsed.lng);
    let finalReason = String(parsed.reason ?? '').trim();
    suggested_bait =
      parsed.suggested_bait === null || parsed.suggested_bait === undefined
        ? null
        : String(parsed.suggested_bait);
    suggested_species =
      parsed.suggested_species === null || parsed.suggested_species === undefined
        ? null
        : String(parsed.suggested_species);

    // Keep bait/species grounded in available evidence from current radius.
    const speciesAllowed = new Set(
      filtered
        .map((c) => String(c.fish_species ?? '').trim().toLowerCase())
        .filter((x) => x.length > 0),
    );
    const baitAllowed = new Set(
      filtered
        .map((c) => String(c.bait ?? '').trim().toLowerCase())
        .filter((x) => x.length > 0),
    );
    if (suggested_species) {
      const speciesNorm = suggested_species.trim().toLowerCase();
      if (speciesAllowed.size > 0 && !speciesAllowed.has(speciesNorm)) {
        suggested_species = null;
      }
    }
    if (suggested_bait) {
      const baitNorm = suggested_bait.trim().toLowerCase();
      if (baitAllowed.size > 0 && !baitAllowed.has(baitNorm)) {
        suggested_bait = null;
      }
    }
    if (speciesAllowed.size === 0) suggested_species = null;
    if (baitAllowed.size === 0) suggested_bait = null;

    if (!Number.isFinite(finalLat) || !Number.isFinite(finalLng) || !finalReason) {
      throw new Error('Invalid model JSON');
    }

    // Hard geo post-validation: keep recommendation near water and within map radius.
    const discovered = await discoverWaterPoints({
      centerLat: lat,
      centerLng: lng,
      modelLat: finalLat,
      modelLng: finalLng,
      safeRadiusKm: safeRadius,
    });
    const externalWaterPoints = discovered.points;
    const waterPoints = externalWaterPoints;
    const sourceSet = new Set<string>((discovered.diagnostics.attempts ?? []).map((a) => a.source));
    const sourceList = [...sourceSet];
    if (waterPoints.length === 0) {
      return json(
        {
          error: 'Could not resolve external water sources for this viewport. Please try again.',
          diagnostics: {
            ...discovered.diagnostics,
            filtered_catches_in_radius: filtered.length,
            fallback_mode: 'best_effort_model_or_center',
            used_water_points: 0,
            external_water_points: externalWaterPoints.length,
          },
        },
        422,
      );
    }
    const waterInRadius = waterPoints
      .map((w) => ({ ...w, dCenter: haversineKm(lat, lng, w.lat, w.lng) }))
      .filter((w) => w.dCenter <= safeRadius * 1.1);
    // Geometries can be huge and represented by center points outside viewport.
    // If strict in-radius check is empty, fall back to nearest known water from expanded search.
    const waterCandidates =
      waterInRadius.length > 0
        ? waterInRadius
        : waterPoints
            .map((w) => ({ ...w, dCenter: haversineKm(lat, lng, w.lat, w.lng) }))
            .sort((a, b) => a.dCenter - b.dCenter)
            .slice(0, 40);
    if (waterCandidates.length === 0) {
      return json(
        { error: 'Could not validate water geometry in this viewport. Move/zoom map and try again.' },
        422,
      );
    }
    const nearestWaterToModel = waterCandidates
      .map((w) => ({ ...w, d: haversineKm(finalLat, finalLng, w.lat, w.lng) }))
      .sort((a, b) => a.d - b.d)[0];
    const nearestWaterToCenter = waterCandidates
      .map((w) => ({ ...w, d: haversineKm(lat, lng, w.lat, w.lng) }))
      .sort((a, b) => a.d - b.d)[0];

    const MAX_MODEL_OFFSET_FROM_WATER_KM = 0.25;
    const snappedToWater =
      !nearestWaterToModel || nearestWaterToModel.d > MAX_MODEL_OFFSET_FROM_WATER_KM;

    // No catches in viewport: choose deterministic nearest water point to center.
    if (filtered.length === 0 && nearestWaterToCenter) {
      finalLat = nearestWaterToCenter.lat;
      finalLng = nearestWaterToCenter.lng;
      suggested_bait = null;
      suggested_species = null;
      if (!/limited local catch data/i.test(finalReason)) {
        finalReason = `${finalReason} This point is selected from the nearest mapped water feature because no local catch records are available in the current view.`;
      }
    }

    // Strict mode: final coordinate must be on/near known water geometry inside visible map area.
    if (nearestWaterToModel) {
      finalLat = nearestWaterToModel.lat;
      finalLng = nearestWaterToModel.lng;
    }

    if (snappedToWater && !/near water/i.test(finalReason)) {
      finalReason = `${finalReason} The final point is snapped closer to a mapped water object for reliability.`;
    }
    finalReason = removeInternalOrProcessPhrases(finalReason);

    return json(
      {
        lat: finalLat,
        lng: finalLng,
        reason: finalReason,
        suggested_bait,
        suggested_species,
        ...(sourceList.length ? { sources: sourceList } : {}),
        ...(confidence !== undefined ? { confidence } : {}),
        ...(assumptions?.length ? { assumptions } : {}),
        ...(nearbyEvidence?.length ? { nearby_evidence: nearbyEvidence } : {}),
        diagnostics: {
          ...discovered.diagnostics,
          filtered_catches_in_radius: filtered.length,
          snapped_to_water: snappedToWater,
          used_water_points: waterCandidates.length,
          external_water_points: externalWaterPoints.length,
        },
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
