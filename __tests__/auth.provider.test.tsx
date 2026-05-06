import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';

const mockSignUp = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import { AuthProvider, useAuth } from '@/lib/auth';

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
  });

  it('signUp returns needsEmailConfirmation when session is missing', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let out: Awaited<ReturnType<(typeof result.current)['signUp']>>;
    await act(async () => {
      out = await result.current.signUp('fish@test.ru', '12345678', 'Peter');
    });

    expect(out!.needsEmailConfirmation).toBe(true);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'fish@test.ru',
        password: '12345678',
        options: expect.objectContaining({
          emailRedirectTo: expect.any(String),
          data: { display_name: 'Peter' },
        }),
      }),
    );
  });

  it('signUp without confirmation: session exists - flag is false', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
        session: { access_token: 'x' },
      },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let out: Awaited<ReturnType<(typeof result.current)['signUp']>>;
    await act(async () => {
      out = await result.current.signUp('a@test.ru', '12345678', 'Ann');
    });

    expect(out!.needsEmailConfirmation).toBe(false);
    await waitFor(() =>
      expect(result.current.session).toEqual(
        expect.objectContaining({ access_token: 'x' }),
      ),
    );
  });
});
