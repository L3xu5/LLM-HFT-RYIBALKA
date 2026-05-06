import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter email')
  .email('Invalid email')
  .transform((s) => s.toLowerCase());

const passwordField = z
  .string()
  .min(8, 'Minimum 8 characters (matches common Supabase policy)')
  .max(72, 'Password must be at most 72 characters (storage limit)');

/** Shared rules for sign-in / sign-up forms (password >=8 often matches Supabase policy). */
export const signInSchema = z.object({
  email: emailField,
  password: passwordField,
});

/** Display name is optional: empty or at least 2 chars after trim (spaces only do not count). */
export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(40, 'Maximum 40 characters')
    .refine((s) => s.length === 0 || s.length >= 2, {
      message: 'Display name: at least 2 characters or leave empty',
    }),
  email: emailField,
  password: passwordField,
  confirmPassword: z.string().min(1, 'Repeat password'),
}).superRefine((values, ctx) => {
  if (values.password !== values.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    });
  }
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
