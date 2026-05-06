// Extra mocks when needed - react-native preset already bootstraps RN environment.

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `https://test.app${path === '/' ? '' : path}`),
}));
