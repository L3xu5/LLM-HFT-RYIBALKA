import { catchFormSchema } from '@/lib/catchForm';

describe('catchFormSchema', () => {
  it('accepts empty optional strings and boolean flag', () => {
    const r = catchFormSchema.safeParse({
      fish_species: '',
      weight_g: '',
      bait: '',
      gear: '',
      notes: '',
      is_public: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects overly long fields', () => {
    const r = catchFormSchema.safeParse({
      fish_species: 'x'.repeat(81),
      weight_g: '',
      bait: '',
      gear: '',
      notes: '',
      is_public: false,
    });
    expect(r.success).toBe(false);
  });
});
