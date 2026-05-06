import type { CatchPhoto, CatchRow, CatchWithPhotos } from '@/types/catch';

import { supabase } from '@/lib/supabase';

type CatchDbRow = CatchRow & {
  catch_photos: CatchPhoto[] | null;
};

/** Insert/update errors: FK, RLS, session. */
function explainMutationError(err: unknown): Error {
  const e = err as { code?: string; message?: string };
  const msg = String(e?.message ?? err);
  const code = e?.code;

  if (code === '23503' || /foreign key constraint/i.test(msg)) {
    return new Error(
      'No profile row exists for this account (profiles table). Sign out/in again or verify migration and signup profile trigger.',
    );
  }
  if (
    code === '42501' ||
    /row-level security/i.test(msg) ||
    /violates row-level security/i.test(msg)
  ) {
    return new Error(
      'Write permission denied (RLS). Sign in and ensure policies from supabase/migrations are applied in Supabase.',
    );
  }
  if (/jwt|session|invalid/i.test(msg) && /token|auth/i.test(msg)) {
    return new Error('Session is invalid. Sign out and sign in again.');
  }
  return err instanceof Error ? err : new Error(msg);
}

/** PostgREST: table missing in schema or URL points to different project. */
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
      'The Supabase project has no public.catches table, or EXPO_PUBLIC_SUPABASE_URL points to another project. Run: supabase link && supabase db push, or apply SQL from supabase/migrations/0001_init.sql in Dashboard -> SQL Editor for the same project.',
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

/** FK catches -> profiles: insert fails if profile is missing (older user / no trigger). */
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
      : (user.email?.split('@')[0] ?? 'Angler');

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
  if (!user) throw new Error('Not authenticated');

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
  if (!user) throw new Error('Not authenticated');

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
 * Public URLs for objects in `catch-photos` bucket (bucket is public in migration).
 * Use directly for rendering; signed URL is an optional enhancement for private buckets.
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
 * Signed URLs (for private buckets or stricter access rules).
 * Never throws: failure for one file does not block others.
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
        /* keep publicPhotoUrl from resolveCatchPhotoPublicUrls */
      }
    }),
  );
  return out;
}
