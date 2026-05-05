import type { CatchPhoto, CatchRow, CatchWithPhotos } from '@/types/catch';

import { supabase } from '@/lib/supabase';

type CatchDbRow = CatchRow & {
  catch_photos: CatchPhoto[] | null;
};

/** Вставка/обновление: FK, RLS, сессия. */
function explainMutationError(err: unknown): Error {
  const e = err as { code?: string; message?: string };
  const msg = String(e?.message ?? err);
  const code = e?.code;

  if (code === '23503' || /foreign key constraint/i.test(msg)) {
    return new Error(
      'Нет строки профиля для вашего аккаунта (таблица profiles). Выйдите и войдите снова или проверьте миграцию и триггер на создание профиля при регистрации.',
    );
  }
  if (
    code === '42501' ||
    /row-level security/i.test(msg) ||
    /violates row-level security/i.test(msg)
  ) {
    return new Error(
      'Отказано в записи (RLS). Войдите в аккаунт и проверьте, что в Supabase применены политики из supabase/migrations.',
    );
  }
  if (/jwt|session|invalid/i.test(msg) && /token|auth/i.test(msg)) {
    return new Error('Сессия недействительна. Выйдите и войдите снова.');
  }
  return err instanceof Error ? err : new Error(msg);
}

/** PostgREST: таблица не в схеме / другой проект в URL. */
function explainCatchQueryError(err: unknown): Error {
  const e = err as { code?: string; message?: string };
  const msg = String(e?.message ?? err);
  const code = e?.code;
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    /could not find the ['"]?public\.catches['"]? table/i.test(msg) ||
    /relation .*does not exist/i.test(msg) ||
    (/schema cache/i.test(msg) && /catches/i.test(msg))
  ) {
    return new Error(
      'В проекте Supabase нет таблицы public.catches или EXPO_PUBLIC_SUPABASE_URL указывает на другой проект. Выполните: supabase link && supabase db push — либо SQL из supabase/migrations/0001_init.sql в Dashboard → SQL Editor для того же проекта.',
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

async function attachAuthors(rows: CatchDbRow[]): Promise<CatchWithPhotos[]> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return [];
  const { data: profiles, error } = await supabase.from('profiles').select('id, display_name').in('id', ids);
  if (error) throw error;
  const map = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string | null]));
  return rows.map((r) => ({
    ...r,
    catch_photos: r.catch_photos ?? [],
    author_name: map.get(r.user_id) ?? null,
  }));
}

export async function fetchCatches(): Promise<CatchWithPhotos[]> {
  const { data, error } = await supabase
    .from('catches')
    .select('*, catch_photos(*)')
    .order('caught_at', { ascending: false })
    .limit(800);
  if (error) throw explainCatchQueryError(error);
  return attachAuthors((data ?? []) as CatchDbRow[]);
}

export async function fetchCatchById(id: string): Promise<CatchWithPhotos | null> {
  const { data, error } = await supabase.from('catches').select('*, catch_photos(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withAuthor] = await attachAuthors([data as CatchDbRow]);
  return withAuthor ?? null;
}

export type UpsertCatchInput = {
  lat: number;
  lng: number;
  fish_species?: string | null;
  weight_g?: number | null;
  bait?: string | null;
  gear?: string | null;
  notes?: string | null;
  caught_at?: string;
  is_public: boolean;
};

/** FK catches → profiles: если профиля нет (старый пользователь / без триггера), вставка падает. */
async function ensureProfileRow(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<void> {
  const { data: row, error: selErr } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (selErr) throw explainMutationError(selErr);
  if (row) return;

  const metaName = user.user_metadata?.display_name;
  const displayName =
    typeof metaName === 'string' && metaName.trim().length > 0
      ? metaName.trim()
      : (user.email?.split('@')[0] ?? 'Рыбак');

  const { error: insErr } = await supabase.from('profiles').insert({
    id: user.id,
    display_name: displayName,
  });
  if (insErr && !/duplicate key|unique constraint/i.test(String(insErr.message))) {
    throw explainMutationError(insErr);
  }
}

export async function createCatch(input: UpsertCatchInput): Promise<CatchRow> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw explainMutationError(userErr);
  const user = userData.user;
  if (!user) throw new Error('Не авторизован');

  await ensureProfileRow(user);

  const weightRounded =
    input.weight_g != null && Number.isFinite(input.weight_g) ? Math.round(input.weight_g) : null;

  const { data, error } = await supabase
    .from('catches')
    .insert({
      user_id: user.id,
      lat: input.lat,
      lng: input.lng,
      fish_species: input.fish_species ?? null,
      weight_g: weightRounded,
      bait: input.bait ?? null,
      gear: input.gear ?? null,
      notes: input.notes ?? null,
      caught_at: input.caught_at ?? new Date().toISOString(),
      is_public: input.is_public,
    })
    .select('*')
    .single();
  if (error) throw explainMutationError(error);
  return data as CatchRow;
}

export async function updateCatch(id: string, input: Partial<UpsertCatchInput>): Promise<CatchRow> {
  const patch =
    input.weight_g !== undefined && input.weight_g != null && Number.isFinite(input.weight_g)
      ? { ...input, weight_g: Math.round(input.weight_g) }
      : input;

  const { data, error } = await supabase.from('catches').update(patch).eq('id', id).select('*').single();
  if (error) throw explainMutationError(error);
  return data as CatchRow;
}

export async function deleteCatch(id: string): Promise<void> {
  const existing = await fetchCatchById(id);
  if (!existing) return;

  const paths = existing.catch_photos.map((p) => p.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from('catch-photos').remove(paths);
  }

  const { error } = await supabase.from('catches').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadCatchPhotos(catchId: string, uris: string[]): Promise<CatchPhoto[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error('Не авторизован');

  const inserted: CatchPhoto[] = [];

  for (const uri of uris) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const contentType = blob.type || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const objectPath = `${user.id}/${catchId}/${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${ext}`;

    const { error: upErr } = await supabase.storage.from('catch-photos').upload(objectPath, blob, {
      contentType,
      upsert: false,
    });
    if (upErr) throw explainMutationError(upErr);

    const { data: row, error: insErr } = await supabase
      .from('catch_photos')
      .insert({ catch_id: catchId, storage_path: objectPath })
      .select('*')
      .single();
    if (insErr) throw explainMutationError(insErr);
    inserted.push(row as CatchPhoto);
  }

  return inserted;
}

export function publicPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from('catch-photos').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Публичные URL для объектов в bucket `catch-photos` (в миграции bucket public).
 * Используйте сразу для отображения; подписанный URL — опциональное улучшение для приватного bucket.
 */
export function resolveCatchPhotoPublicUrls(
  photos: Pick<CatchPhoto, 'id' | 'storage_path'>[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of photos) {
    const raw = p.storage_path?.trim();
    if (!raw || !p.id) continue;
    out[p.id] = publicPhotoUrl(raw);
  }
  return out;
}

/**
 * Подписанные URL (на случай приватного bucket или расширенных ограничений).
 * Никогда не бросает: ошибки по одному файлу не отменяют остальные.
 */
export async function resolveCatchPhotoSignedUrls(
  photos: Pick<CatchPhoto, 'id' | 'storage_path'>[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    photos.map(async (p) => {
      const raw = p.storage_path?.trim();
      if (!raw || !p.id) return;
      try {
        const { data, error } = await supabase.storage.from('catch-photos').createSignedUrl(raw, 3600);
        if (!error && data?.signedUrl) out[p.id] = data.signedUrl;
      } catch {
        /* остаёмся на publicPhotoUrl из resolveCatchPhotoPublicUrls */
      }
    }),
  );
  return out;
}
