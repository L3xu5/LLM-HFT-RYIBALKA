jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { fetchProfile, updateDisplayName } from '@/lib/api/profile';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as jest.Mock;

describe('profile api', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('fetchProfile возвращает строку или null', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'u1', display_name: 'Пётр', created_at: '' },
            error: null,
          }),
        })),
      })),
    });

    const p = await fetchProfile('u1');
    expect(p?.display_name).toBe('Пётр');
  });

  it('updateDisplayName вызывает update', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      update: jest.fn(() => ({ eq })),
    });

    await updateDisplayName('u1', 'Новое имя');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });
});
