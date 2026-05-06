import { formatAuthError, signUpNeedsEmailConfirmation } from '@/lib/authHelpers';

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

  it('returns original message when unknown', () => {
    expect(formatAuthError(new Error('Custom xyz'))).toBe('Custom xyz');
  });
});
