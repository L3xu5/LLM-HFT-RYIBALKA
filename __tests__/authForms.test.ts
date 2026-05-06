import { signInSchema, signUpSchema } from '@/lib/authForms';

describe('signInSchema', () => {
  it('accepts valid data', () => {
    expect(
      signInSchema.safeParse({ email: 'a@test.ru', password: '12345678' }).success,
    ).toBe(true);
  });

  it('rejects a short password', () => {
    expect(signInSchema.safeParse({ email: 'a@test.ru', password: 'short' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(signInSchema.safeParse({ email: 'bad', password: '12345678' }).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('accepts valid data', () => {
    expect(
      signUpSchema.safeParse({
        displayName: 'Ivan',
        email: 'ivan@test.ru',
        password: '12345678',
      }).success,
    ).toBe(true);
  });

  it('allows an empty name', () => {
    expect(
      signUpSchema.safeParse({
        displayName: '',
        email: 'a@test.ru',
        password: '12345678',
      }).success,
    ).toBe(true);
  });

  it('allows whitespace-only name after trim', () => {
    expect(
      signUpSchema.safeParse({
        displayName: '   ',
        email: 'a@test.ru',
        password: '12345678',
      }).success,
    ).toBe(true);
  });

  it('rejects a one-letter name', () => {
    expect(
      signUpSchema.safeParse({
        displayName: 'A',
        email: 'a@test.ru',
        password: '12345678',
      }).success,
    ).toBe(false);
  });

  it('rejects a short password', () => {
    expect(
      signUpSchema.safeParse({
        displayName: 'Ivan',
        email: 'a@test.ru',
        password: '1234567',
      }).success,
    ).toBe(false);
  });

  it('normalizes email to lowercase', () => {
    const r = signUpSchema.safeParse({
      displayName: '',
      email: ' User@Test.RU ',
      password: '12345678',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@test.ru');
  });
});
