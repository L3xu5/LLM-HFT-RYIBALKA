import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .min(1, 'Введите email')
  .email('Некорректный email')
  .transform((s) => s.toLowerCase());

const passwordField = z
  .string()
  .min(8, 'Минимум 8 символов (как в политике Supabase)')
  .max(72, 'Пароль не длиннее 72 символов (ограничение хранения)');

/** Общие правила форм входа / регистрации (пароль ≥8 часто совпадает с политикой Supabase). */
export const signInSchema = z.object({
  email: emailField,
  password: passwordField,
});

/** Имя необязательно: пусто или от 2 символов после trim (пробелы не считаются). */
export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(40, 'Максимум 40 символов')
    .refine((s) => s.length === 0 || s.length >= 2, {
      message: 'Имя: минимум 2 символа или оставьте поле пустым',
    }),
  email: emailField,
  password: passwordField,
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
