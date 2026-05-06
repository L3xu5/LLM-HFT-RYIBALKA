import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, TextInput } from 'react-native';

const mockReplace = jest.fn();
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signUp: (...args: unknown[]) => mockSignUp(...args),
  }),
}));

jest.mock('@/components/PrimaryButton', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PrimaryButton: ({
      title,
      onPress,
    }: {
      title: string;
      onPress?: () => void;
    }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

import SignInScreen from '../app/(auth)/sign-in';
import SignUpScreen from '../app/(auth)/sign-up';

describe('Auth screens integration', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSignIn.mockReset();
    mockSignUp.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows inline sign-in error from auth failure', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid login credentials'));
    const view = render(<SignInScreen />);

    const inputs = view.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], 'fish@example.com');
    fireEvent.changeText(inputs[1], '12345678');
    fireEvent(inputs[0], 'blur');
    fireEvent(inputs[1], 'blur');
    fireEvent(screen.getByRole('button', { name: 'Sign in' }), 'onPress');

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalledWith('Sign-in failed', 'Invalid email or password.');
  });

  it('starts dynamic cooldown from security retry-after message', async () => {
    mockSignUp.mockRejectedValueOnce(
      new Error('For security purposes, you can only request this after 51 seconds.'),
    );
    const view = render(<SignUpScreen />);

    const inputs = view.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], 'Peter');
    fireEvent.changeText(inputs[1], 'fish@example.com');
    fireEvent.changeText(inputs[2], '12345678');
    fireEvent.changeText(inputs[3], '12345678');
    fireEvent(inputs[0], 'blur');
    fireEvent(inputs[1], 'blur');
    fireEvent(inputs[2], 'blur');
    fireEvent(inputs[3], 'blur');
    fireEvent(screen.getByRole('button', { name: 'Create account' }), 'onPress');

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign-up failed',
      expect.stringContaining('51 seconds'),
    );
  });
});
