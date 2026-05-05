import type { Session, User } from '@supabase/supabase-js';

/**
 * После signUp при включённом «Confirm email» в Supabase сессии нет, пока пользователь не подтвердил почту.
 */
export function signUpNeedsEmailConfirmation(user: User | null, session: Session | null): boolean {
  return Boolean(user && !session);
}

/** Человекочитаемые сообщения для типичных ошибок Supabase Auth */
export function formatAuthError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    if (/invalid login credentials/i.test(m)) return 'Неверный email или пароль.';
    if (/email not confirmed/i.test(m)) return 'Сначала подтвердите email по ссылке из письма.';
    if (/user already registered|already been registered|already exists/i.test(m)) {
      return 'Этот email уже зарегистрирован. Войдите или восстановите пароль.';
    }
    if (/password/i.test(m) && /short|least|weak|characters/i.test(m)) {
      return 'Пароль не проходит политику безопасности проекта (длина/сложность).';
    }
    if (/signup.*disabled|signups not allowed|registration.*disabled/i.test(m)) {
      return 'Регистрация отключена в настройках Supabase Auth.';
    }
    if (/invalid email/i.test(m)) return 'Некорректный email.';
    if (/rate limit|too many requests/i.test(m)) return 'Слишком много попыток. Подождите немного.';
    if (/fetch failed|network/i.test(m)) return 'Нет сети или недоступен Supabase. Проверьте URL и ключ в .env.';
    return m;
  }
  return String(err);
}
