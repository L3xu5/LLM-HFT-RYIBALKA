jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'jwt-test',
          },
        },
        error: null,
      }),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { requestRecommendation } from '@/lib/api/recommend';
import { supabase } from '@/lib/supabase';

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<typeof supabase.functions.invoke>;
const mockGetUser = supabase.auth.getUser as jest.MockedFunction<typeof supabase.auth.getUser>;
const mockGetSession = supabase.auth.getSession as jest.MockedFunction<typeof supabase.auth.getSession>;

describe('requestRecommendation', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'jwt-test',
        } as import('@supabase/supabase-js').Session,
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  });

  it('calls recommend-spot and returns payload', async () => {
    mockInvoke.mockResolvedValue({
      data: { lat: 56, lng: 38, reason: 'test', suggested_bait: 'worm' },
      error: null,
    });

    const r = await requestRecommendation({ lat: 55.1, lng: 37.2, radiusKm: 50 });

    expect(mockInvoke).toHaveBeenCalledWith('recommend-spot', {
      body: { lat: 55.1, lng: 37.2, radiusKm: 50 },
      timeout: 120_000,
      headers: { Authorization: 'Bearer jwt-test' },
    });
    expect(r.reason).toBe('test');
    expect(r.suggested_bait).toBe('worm');
  });

  it('throws if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    await expect(requestRecommendation({ lat: 1, lng: 2 })).rejects.toThrow(/Sign in/);
  });

  it('throws if session has no access_token', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    await expect(requestRecommendation({ lat: 1, lng: 2 })).rejects.toThrow(/Session is unavailable/);
  });

  it('throws if response body includes error', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'missing secrets' },
      error: null,
    });

    await expect(requestRecommendation({ lat: 1, lng: 2 })).rejects.toThrow('missing secrets');
  });

  it('extracts sources from diagnostics attempts', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        lat: 56,
        lng: 38,
        reason: 'test',
        nearby_evidence: ['river nearby', 'popular cod catches'],
        diagnostics: {
          attempts: [
            { source: 'nominatim', around: 'center', radius_km: 12 },
            { source: 'overpass', around: 'model', radius_km: 12 },
            { source: 'nominatim', around: 'model', radius_km: 45 },
          ],
        },
      },
      error: null,
    });

    const r = await requestRecommendation({ lat: 55.1, lng: 37.2, radiusKm: 50 });
    expect(r.sources).toEqual(['nominatim', 'overpass']);
    expect(r.nearby_evidence).toEqual(['river nearby', 'popular cod catches']);
    expect(r.diagnostics?.attempts?.length).toBe(3);
  });

  it('keeps explicit sources and merges with attempts', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        lat: 56,
        lng: 38,
        reason: 'test',
        sources: ['nominatim'],
        diagnostics: {
          attempts: [{ source: 'overpass', around: 'center', radius_km: 20, hits: 7 }],
        },
      },
      error: null,
    });

    const r = await requestRecommendation({ lat: 55.1, lng: 37.2, radiusKm: 50 });
    expect(r.sources).toEqual(['nominatim', 'overpass']);
    expect(r.diagnostics?.attempts?.[0]?.hits).toBe(7);
  });

  it('retries once for transient function fetch error', async () => {
    const transient = Object.assign(new Error('network failed'), { name: 'FunctionsFetchError' });
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: transient })
      .mockResolvedValueOnce({ data: { lat: 1, lng: 2, reason: 'ok' }, error: null });

    const r = await requestRecommendation({ lat: 1, lng: 2 });
    expect(r.reason).toBe('ok');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('keeps and merges all external water sources diagnostics', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        lat: 56.11,
        lng: 38.22,
        reason: 'test',
        sources: ['overpass'],
        diagnostics: {
          external_water_points: 19,
          attempts: [
            { source: 'nominatim', around: 'center', radius_km: 12, hits: 6 },
            { source: 'overpass', around: 'model', radius_km: 12, hits: 3 },
          ],
        },
      },
      error: null,
    });

    const r = await requestRecommendation({ lat: 55.1, lng: 37.2, radiusKm: 50 });
    expect(r.sources).toEqual(['overpass', 'nominatim']);
    expect(r.diagnostics?.external_water_points).toBe(19);
    expect(r.diagnostics?.attempts).toEqual([
      { source: 'nominatim', around: 'center', radius_km: 12, hits: 6 },
      { source: 'overpass', around: 'model', radius_km: 12, hits: 3 },
    ]);
  });

  it('collects overpass and nominatim sources together', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        lat: 60.01,
        lng: 30.02,
        reason: 'test',
        sources: ['nominatim'],
        diagnostics: {
          attempts: [
            { source: 'nominatim', around: 'center', radius_km: 20, hits: 8 },
            { source: 'overpass', around: 'center', radius_km: 20, hits: 2 },
          ],
          external_water_points: 21,
          used_water_points: 18,
        },
      },
      error: null,
    });

    const r = await requestRecommendation({ lat: 60, lng: 30, radiusKm: 30 });
    expect(r.sources).toEqual(['nominatim', 'overpass']);
    expect(r.diagnostics?.external_water_points).toBe(21);
    expect(r.diagnostics?.used_water_points).toBe(18);
    expect(r.diagnostics?.attempts?.every((x) => typeof x.hits === 'number')).toBe(true);
  });
});
