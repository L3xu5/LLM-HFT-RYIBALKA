import { extractRetryAfterSeconds, formatAuthError, signUpNeedsEmailConfirmation } from '@/lib/authHelpers';

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

describe('formatAuthError', () => {
  it('maps invalid login credentials', () => {
    expect(formatAuthError(new Error('Invalid login credentials'))).toContain('Invalid email');
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

  it('returns original message when unknown', () => {
    expect(formatAuthError(new Error('Custom xyz'))).toBe('Custom xyz');
  });

  it('maps security wait message with seconds', () => {
    expect(
      formatAuthError(new Error('For security purposes, you can only request this after 51 seconds.')),
    ).toContain('51 seconds');
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
