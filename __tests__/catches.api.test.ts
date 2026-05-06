import { fetchCatches } from '@/lib/api/catches';

const mockLimit = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'u1', display_name: 'Ivan' }],
              error: null,
            }),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: (...args: unknown[]) => mockLimit(...args),
          })),
        })),
      };
    }),
  },
}));

describe('fetchCatches', () => {
  beforeEach(() => {
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'c1',
          user_id: 'u1',
          lat: 1,
          lng: 2,
          fish_species: 'pike',
          weight_g: 1000,
          bait: null,
          gear: null,
          notes: null,
          caught_at: new Date().toISOString(),
          is_public: true,
          created_at: new Date().toISOString(),
          catch_photos: [],
        },
      ],
      error: null,
    });
  });

  it('requests catches with catch_photos', async () => {
    const list = await fetchCatches();
    expect(list).toHaveLength(1);
    expect(list[0].fish_species).toBe('pike');
    expect(mockLimit).toHaveBeenCalledWith(800);
  });
});
