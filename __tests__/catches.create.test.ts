jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: jest.fn(),
  },
}));

import { createCatch } from '@/lib/api/catches';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as jest.Mock;

describe('createCatch', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('вставляет запись в catches', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
            })),
          })),
        };
      }
      if (table === 'catches') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'c1',
                  user_id: 'user-1',
                  lat: 55,
                  lng: 37,
                  fish_species: 'окунь',
                  weight_g: null,
                  bait: null,
                  gear: null,
                  notes: null,
                  caught_at: new Date().toISOString(),
                  is_public: true,
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const row = await createCatch({
      lat: 55,
      lng: 37,
      is_public: true,
      fish_species: 'окунь',
    });

    expect(row.id).toBe('c1');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('catches');
  });
});
