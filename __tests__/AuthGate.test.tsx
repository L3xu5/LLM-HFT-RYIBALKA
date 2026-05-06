import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockReplace = jest.fn();
const mockSegments = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments(),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

import { AuthGate } from '@/components/AuthGate';
import { useAuth } from '@/lib/auth';

describe('AuthGate', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReset();
    mockReplace.mockClear();
    mockSegments.mockReset();
  });

  it('shows loader while loading=true', () => {
    jest.mocked(useAuth).mockReturnValue({
      session: null,
      loading: true,
      signIn: jest.fn(),
      signUp: jest.fn().mockResolvedValue({ needsEmailConfirmation: false }),
      signOut: jest.fn(),
    });
    mockSegments.mockReturnValue(['(auth)', 'sign-in']);

    const { queryByText } = render(
      <AuthGate>
        <Text>child</Text>
      </AuthGate>,
    );

    expect(queryByText('child')).toBeNull();
  });

  it('redirects to sign-in if no session and group is not (auth)', async () => {
    jest.mocked(useAuth).mockReturnValue({
      session: null,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn().mockResolvedValue({ needsEmailConfirmation: false }),
      signOut: jest.fn(),
    });
    mockSegments.mockReturnValue(['(tabs)', 'map']);

    render(
      <AuthGate>
        <Text>inside</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
  });

  it('redirects to map if session exists and (auth) screen is open', async () => {
    jest.mocked(useAuth).mockReturnValue({
      session: { access_token: 't' } as never,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn().mockResolvedValue({ needsEmailConfirmation: false }),
      signOut: jest.fn(),
    });
    mockSegments.mockReturnValue(['(auth)', 'sign-in']);

    render(
      <AuthGate>
        <Text>inside</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/map'));
  });

  it('redirects to map if session exists and segments are still empty (after login)', async () => {
    jest.mocked(useAuth).mockReturnValue({
      session: { access_token: 't' } as never,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn().mockResolvedValue({ needsEmailConfirmation: false }),
      signOut: jest.fn(),
    });
    mockSegments.mockReturnValue([]);

    render(
      <AuthGate>
        <Text>inside</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/map'));
  });
});
