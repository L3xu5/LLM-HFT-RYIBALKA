import { z } from 'zod';

/** New/edit catch form (shared field schema). */
export const catchFormSchema = z.object({
  fish_species: z.string().max(80).optional().or(z.literal('')),
  weight_g: z.string().optional().or(z.literal('')),
  bait: z.string().max(120).optional().or(z.literal('')),
  gear: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  is_public: z.boolean(),
});

export type CatchFormValues = z.infer<typeof catchFormSchema>;
