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

  it('вызывает recommend-spot и возвращает данные', async () => {
    mockInvoke.mockResolvedValue({
      data: { lat: 56, lng: 38, reason: 'тест', suggested_bait: 'червь' },
      error: null,
    });

    const r = await requestRecommendation({ lat: 55.1, lng: 37.2, radiusKm: 50 });

    expect(mockInvoke).toHaveBeenCalledWith('recommend-spot', {
      body: { lat: 55.1, lng: 37.2, radiusKm: 50 },
      timeout: 120_000,
      headers: { Authorization: 'Bearer jwt-test' },
    });
    expect(r.reason).toBe('тест');
    expect(r.suggested_bait).toBe('червь');
  });

  it('бросает если пользователь не авторизован', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    await expect(requestRecommendation({ lat: 1, lng: 2 })).rejects.toThrow(/Войдите в аккаунт/);
  });

  it('бросает если нет access_token сессии', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    await expect(requestRecommendation({ lat: 1, lng: 2 })).rejects.toThrow(/Сессия недоступна/);
  });

  it('бросает если в теле ответа error', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'нет секретов' },
      error: null,
    });

    await expect(requestRecommendation({ lat: 1, lng: 2 })).rejects.toThrow('нет секретов');
  });
});
