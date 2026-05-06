import type { Session, User } from '@supabase/supabase-js';

/**
 * After signUp, when Supabase "Confirm email" is enabled, there is no session until the email is confirmed.
 */
export function signUpNeedsEmailConfirmation(user: User | null, session: Session | null): boolean {
  return Boolean(user && !session);
}

export type AuthUiFlow = 'signIn' | 'signUp';

function getRawAuthMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  return '';
}

/** HTTP status from supabase-js AuthApiError when present. */
export function getAuthHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

/** Human-readable messages for common Supabase Auth errors. */
export function formatAuthError(err: unknown): string {
  const m = getRawAuthMessage(err);
  const status = getAuthHttpStatus(err);

  if (status === 503 || status === 502 || status === 504) {
    return 'Authentication service is temporarily unavailable. Try again shortly.';
  }
  if (status === 429) {
    if (/email rate limit exceeded/i.test(m)) {
      return 'Too many confirmation emails were requested. Please check your inbox/spam and try again later.';
    }
    return 'Too many requests. Please wait before trying again.';
  }
  if (status === 403 && /failed|captcha|forbidden/i.test(m)) {
    return 'Access denied by authentication rules (Captcha/forbidden). Check Supabase Auth settings.';
  }
  if ((status === 422 || status === 400) && m.trim().length === 0) {
    return 'The server rejected this auth request. Check email/password format.';
  }

  if (!m.trim()) {
    return status ? `Something went wrong (HTTP ${status}). Try again.` : 'Something went wrong. Try again.';
  }

  if (/invalid login credentials|invalid.?grant/i.test(m)) return 'Invalid email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email using the link from the message.';
  if (/user already registered|already been registered|already exists/i.test(m)) {
    return 'This email is already registered. Use Sign in. If you forgot your password, reset it in Supabase Dashboard (Authentication > Users).';
  }
  if (/unable to validate email|bad.?jwt/i.test(m)) return 'Invalid email format.';
  if (/same.?password|reauthentication/i.test(m)) {
    return 'Password reuse not allowed. Choose a different password.';
  }
  if (/password/i.test(m) && /short|least|weak|characters|minimum|policy/i.test(m)) {
    return 'Password does not meet security policy (length/complexity). Try a stronger password.';
  }
  if (/signup.*disabled|signups not allowed|registration.*disabled/i.test(m)) {
    return 'Sign-up is disabled in Supabase Auth settings.';
  }
  if (/email address not authorized|invite.?only|not authorized to sign up/i.test(m)) {
    return 'Sign-ups are invite-only or this email is not allow-listed. Ask an admin.';
  }
  if (/invalid email/i.test(m)) return 'Invalid email.';
  if (/email rate limit exceeded/i.test(m)) {
    return 'Too many confirmation emails were requested. Please check your inbox/spam and try again later.';
  }
  if (/invalid.?otp|otp.?expired|token.?has expired|jwt expired|link is invalid or has expired|email link is invalid/i.test(m)) {
    return 'Confirmation or login link expired or is invalid. Try signing up or signing in again.';
  }
  if (/user (has been )?banned|account suspended|disabled.*user/i.test(m)) {
    return 'This account cannot sign in. Contact support.';
  }
  if (/database error saving new user|unexpected failure saving/i.test(m)) {
    return 'Server could not finish registration. Try again later or check Supabase Auth logs.';
  }
  const retrySec = extractRetryAfterSeconds(m);
  if (retrySec !== null) {
    return `For security reasons, please wait ${retrySec} seconds before trying again.`;
  }
  if (/rate limit|too many requests/i.test(m)) return 'Too many attempts. Please wait a bit.';
  if (/fetch failed|failed to fetch|network request failed|network.?error|econnrefused|timed out/i.test(m)) {
    return 'No network or Supabase is unreachable. Check connectivity and EXPO_PUBLIC_SUPABASE_URL / anon key.';
  }
  return m;
}

/**
 * Extra inline hint shown next to formattedAuthMessage on login/register screens (English UX copy).
 */
export function authSecondaryHint(err: unknown, formattedAuthMessage: string, flow: AuthUiFlow): string | null {
  const raw = getRawAuthMessage(err);
  const f = formattedAuthMessage.toLowerCase();
  const r = raw.toLowerCase();
  const pack = `${f}\n${r}`;

  if (flow === 'signIn') {
    if (/confirm your email/.test(f))
      return 'Use the inbox for this exact email, tap Confirm in the Supabase email, then return here.';
    if (/invalid email or password/.test(f))
      return 'Try correcting spelling. No account yet? Use Create one. Signed up recently? Confirm email before signing in.';
    if (/link expired|invalid/i.test(f) || /jwt expired|link is invalid/i.test(r))
      return 'Magic-link expired? Sign in with email + password instead if your flow supports it.';
    if (/security reasons.*wait|too many requests|too many attempts/.test(f) || /429/.test(pack))
      return 'Wait for the countdown or throttle window; avoid repeated submits.';
    if (/confirmation emails/i.test(f))
      return 'Use the latest confirmation email in inbox/spam; do not request a new one too often.';
    if (/unavailable|network|unreachable/.test(f) || /fetch failed|network request failed/i.test(r))
      return 'VPN/firewall/ad blocker may block Supabase; verify URL/key matches this web/native build.';
    if (/banned|cannot sign in|suspended/.test(f))
      return 'If this looks wrong, an admin must check Authentication → Users in Supabase.';
    if (/something went wrong|server rejected/i.test(f))
      return 'Retry once; if it repeats, confirm anon key and Supabase project status.';
    return 'Still stuck? Re-check email, password caps-lock, and that Supabase Auth matches this environment.';
  }

  // signUp
  if (/already registered/i.test(f))
    return 'This email already has an account. Tap Go to sign in below or Sign in in the footer. Password recovery is done in Supabase Dashboard for admins.';
  if (/confirm/i.test(f) && /rate limit|too many|spam/i.test(f))
    return 'Look for existing confirmation mails before requesting again.';
  if (/sign-up is disabled/i.test(f))
    return 'Project operators control Auth policies — enable Email sign-ups from Dashboard.';
  if (/invite-only|allow-listed/i.test(f))
    return 'Ask admins to allow your email or enable public signup for this Supabase project.';
  if (/password/i.test(f) && /policy|weak|characters/i.test(f))
    return 'Use at least 8 characters (often required); add mixed letters/numbers if Supabase enforces stronger rules.';
  if (/invalid email format|invalid email/.test(f))
    return 'Fix typos in the address (missing dot, extra spaces); lowercase is applied automatically.';
  if (/security reasons.*wait/.test(f) || /too many attempts/i.test(f) || /429/.test(pack))
    return 'Wait; spamming Sign up triggers cooldown for abuse prevention.';
  if (/server could not finish|database error/i.test(f))
    return 'Often transient — retry later; inspect Edge Functions / Auth logs if error persists.';
  if (/unavailable|network|unreachable/.test(f) || /fetch failed|network request failed/i.test(r))
    return 'Same checklist as Sign in: connectivity, keys in env at export/build time for web.';
  if (/something went wrong|access denied|captcha/i.test(f))
    return 'Captcha/security hooks require Dashboard-side Auth configuration.';
  return 'Review messages above; if unclear, copy exact wording into Supabase Auth troubleshooting.';
}

export function extractRetryAfterSeconds(text: string): number | null {
  const m = text.match(/after\s+(\d+)\s+seconds?/i);
  if (!m) return null;
  const sec = Number(m[1]);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}
