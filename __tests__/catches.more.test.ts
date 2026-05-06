jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        getPublicUrl: jest.fn((path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/catch-photos/${path}` },
        })),
      })),
    },
  },
}));

import { publicPhotoUrl, updateCatch } from '@/lib/api/catches';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as jest.Mock;

describe('catches api - update / public URL', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('updateCatch calls update->eq->select->single', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'c1',
                user_id: 'u1',
                lat: 1,
                lng: 2,
                fish_species: 'pike',
                weight_g: null,
                bait: null,
                gear: null,
                notes: null,
                caught_at: '',
                is_public: true,
                created_at: '',
              },
              error: null,
            }),
          })),
        })),
      })),
    });

    const row = await updateCatch('c1', { fish_species: 'pike' });
    expect(row.fish_species).toBe('pike');
    expect(mockFrom).toHaveBeenCalledWith('catches');
  });

  it('publicPhotoUrl', () => {
    expect(publicPhotoUrl('u/c/x.jpg')).toContain('x.jpg');
  });
});
