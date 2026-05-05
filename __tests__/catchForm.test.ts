import { catchFormSchema } from '@/lib/catchForm';

describe('catchFormSchema', () => {
  it('принимает пустые необязательные строки и булев флаг', () => {
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

  it('отклоняет слишком длинные поля', () => {
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
