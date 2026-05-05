import { formatAuthError, signUpNeedsEmailConfirmation } from '@/lib/authHelpers';

describe('signUpNeedsEmailConfirmation', () => {
  it('true когда пользователь есть, сессии нет (ожидание подтверждения email)', () => {
    expect(
      signUpNeedsEmailConfirmation({ id: 'u1' } as never, null),
    ).toBe(true);
  });

  it('false когда уже есть сессия', () => {
    expect(signUpNeedsEmailConfirmation({ id: 'u1' } as never, { access_token: 'x' } as never)).toBe(
      false,
    );
  });

  it('false когда пользователя нет', () => {
    expect(signUpNeedsEmailConfirmation(null, null)).toBe(false);
  });
});

describe('formatAuthError', () => {
  it('переводит invalid login credentials', () => {
    expect(formatAuthError(new Error('Invalid login credentials'))).toContain('Неверный email');
  });

  it('переводит email not confirmed', () => {
    expect(formatAuthError(new Error('Email not confirmed'))).toContain('подтвердите email');
  });

  it('переводит duplicate user', () => {
    expect(formatAuthError(new Error('User already registered'))).toContain('уже зарегистрирован');
  });

  it('возвращает исходное сообщение если не распознано', () => {
    expect(formatAuthError(new Error('Custom xyz'))).toBe('Custom xyz');
  });
});
