import {
  authSecondaryHint,
  extractRetryAfterSeconds,
  formatAuthError,
  getAuthHttpStatus,
  signUpNeedsEmailConfirmation,
} from '@/lib/authHelpers';

describe('signUpNeedsEmailConfirmation', () => {
  it('true when user exists and session is missing (email confirmation pending)', () => {
    expect(
      signUpNeedsEmailConfirmation({ id: 'u1' } as never, null),
    ).toBe(true);
  });

  it('false when session already exists', () => {
    expect(signUpNeedsEmailConfirmation({ id: 'u1' } as never, { access_token: 'x' } as never)).toBe(
      false,
    );
  });

  it('false when user is missing', () => {
    expect(signUpNeedsEmailConfirmation(null, null)).toBe(false);
  });
});

function errWithStatus(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

describe('getAuthHttpStatus', () => {
  it('reads numeric status from Auth-like errors', () => {
    expect(getAuthHttpStatus(errWithStatus('Too many', 429))).toBe(429);
    expect(getAuthHttpStatus(new Error('plain'))).toBeUndefined();
  });
});

describe('formatAuthError', () => {
  it('maps invalid login credentials', () => {
    expect(formatAuthError(new Error('Invalid login credentials'))).toContain('Invalid email');
  });

  it('maps invalid_grant like invalid credentials', () => {
    expect(formatAuthError(new Error('invalid_grant'))).toContain('Invalid email');
  });

  it('maps email not confirmed', () => {
    expect(formatAuthError(new Error('Email not confirmed'))).toContain('confirm your email');
  });

  it('maps duplicate user', () => {
    expect(formatAuthError(new Error('User already registered'))).toContain('already registered');
  });

  it('maps email rate limit exceeded', () => {
    expect(formatAuthError(new Error('email rate limit exceeded'))).toContain(
      'confirmation emails',
    );
  });

  it('maps HTTP 503 without body', () => {
    expect(formatAuthError(errWithStatus('', 503))).toContain('temporarily unavailable');
  });

  it('maps HTTP 429 generic', () => {
    expect(formatAuthError(errWithStatus('slow down', 429))).toContain('Too many requests');
  });

  it('maps expired confirmation link phrasing', () => {
    expect(formatAuthError(new Error('Email link is invalid or has expired'))).toContain('expired');
  });

  it('maps database registration failure', () => {
    expect(formatAuthError(new Error('Database error saving new user'))).toContain('registration');
  });

  it('maps banned user', () => {
    expect(formatAuthError(new Error('User banned'))).toContain('cannot sign in');
  });

  it('maps sign-ups disabled string', () => {
    expect(formatAuthError(new Error('Signups not allowed for this instance'))).toContain('disabled');
  });

  it('maps unauthorized email signup string', () => {
    expect(formatAuthError(new Error('Email address not authorized'))).toMatch(/invite-only/i);
  });

  it('returns original message when unknown', () => {
    expect(formatAuthError(new Error('Custom xyz'))).toBe('Custom xyz');
  });

  it('maps security wait message with seconds', () => {
    expect(
      formatAuthError(new Error('For security purposes, you can only request this after 51 seconds.')),
    ).toContain('51 seconds');
  });
});

describe('authSecondaryHint', () => {
  it('sign-in: email not confirmed', () => {
    const msg = formatAuthError(new Error('Email not confirmed'));
    expect(authSecondaryHint(new Error('Email not confirmed'), msg, 'signIn')).toContain('exact email');
  });

  it('sign-in: invalid credentials', () => {
    const msg = formatAuthError(new Error('Invalid login credentials'));
    expect(authSecondaryHint(new Error('Invalid login credentials'), msg, 'signIn')).toContain('Create one');
  });

  it('sign-up: duplicate email', () => {
    const msg = formatAuthError(new Error('User already registered'));
    expect(authSecondaryHint(new Error('User already registered'), msg, 'signUp')).toContain(
      'already has an account',
    );
  });

  it('sign-up: weak password hint', () => {
    const msg = formatAuthError(new Error('Password should be at least 12 characters'));
    expect(authSecondaryHint(new Error('Password should be at least 12 characters'), msg, 'signUp')).toContain(
      '8 characters',
    );
  });

  it('fallback hint when message unknown', () => {
    const msg = formatAuthError(new Error('Totally unknown'));
    expect(authSecondaryHint(new Error('Totally unknown'), msg, 'signIn')).toContain('Still stuck');
  });
});

describe('extractRetryAfterSeconds', () => {
  it('extracts retry-after seconds from auth message', () => {
    expect(extractRetryAfterSeconds('For security purposes, you can only request this after 51 seconds.')).toBe(51);
  });

  it('returns null when no retry-after is present', () => {
    expect(extractRetryAfterSeconds('email rate limit exceeded')).toBeNull();
  });
});
