import type { Session, User } from '@supabase/supabase-js';

/**
 * After signUp, when Supabase "Confirm email" is enabled, there is no session until the email is confirmed.
 */
export function signUpNeedsEmailConfirmation(user: User | null, session: Session | null): boolean {
  return Boolean(user && !session);
}

/** Human-readable messages for common Supabase Auth errors. */
export function formatAuthError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    if (/invalid login credentials/i.test(m)) return 'Invalid email or password.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email using the link from the message.';
    if (/user already registered|already been registered|already exists/i.test(m)) {
      return 'This email is already registered. Sign in or reset password.';
    }
    if (/password/i.test(m) && /short|least|weak|characters/i.test(m)) {
      return 'Password does not meet project security policy (length/complexity).';
    }
    if (/signup.*disabled|signups not allowed|registration.*disabled/i.test(m)) {
      return 'Sign-up is disabled in Supabase Auth settings.';
    }
    if (/invalid email/i.test(m)) return 'Invalid email.';
    if (/rate limit|too many requests/i.test(m)) return 'Too many attempts. Please wait a bit.';
    if (/fetch failed|network/i.test(m)) return 'No network or Supabase is unavailable. Check URL and key in .env.';
    return m;
  }
  return String(err);
}
