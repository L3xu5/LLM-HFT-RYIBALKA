import { signInSchema, signUpSchema } from '@/lib/authForms';

describe('signInSchema', () => {
  it('принимает валидные данные', () => {
    expect(
      signInSchema.safeParse({ email: 'a@test.ru', password: '12345678' }).success,
    ).toBe(true);
  });

  it('отклоняет короткий пароль', () => {
    expect(signInSchema.safeParse({ email: 'a@test.ru', password: 'short' }).success).toBe(false);
  });

  it('отклоняет невалидный email', () => {
    expect(signInSchema.safeParse({ email: 'bad', password: '12345678' }).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('принимает валидные данные', () => {
    expect(
      signUpSchema.safeParse({
        displayName: 'Иван',
        email: 'ivan@test.ru',
        password: '12345678',
      }).success,
    ).toBe(true);
  });

  it('разрешает пустое имя', () => {
    expect(
      signUpSchema.safeParse({
        displayName: '',
        email: 'a@test.ru',
        password: '12345678',
      }).success,
    ).toBe(true);
  });

  it('после trim пустое имя из пробелов допустимо', () => {
    expect(
      signUpSchema.safeParse({
        displayName: '   ',
        email: 'a@test.ru',
        password: '12345678',
      }).success,
    ).toBe(true);
  });

  it('отклоняет одну букву в имени', () => {
    expect(
      signUpSchema.safeParse({
        displayName: 'Я',
        email: 'a@test.ru',
        password: '12345678',
      }).success,
    ).toBe(false);
  });

  it('отклоняет короткий пароль', () => {
    expect(
      signUpSchema.safeParse({
        displayName: 'Иван',
        email: 'a@test.ru',
        password: '1234567',
      }).success,
    ).toBe(false);
  });

  it('нормализует email в нижний регистр', () => {
    const r = signUpSchema.safeParse({
      displayName: '',
      email: ' User@Test.RU ',
      password: '12345678',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@test.ru');
  });
});
