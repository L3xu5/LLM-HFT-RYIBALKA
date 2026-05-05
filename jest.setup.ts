// Доп. моки при необходимости — пресет react-native уже поднимает RN environment.

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `https://test.app${path === '/' ? '' : path}`),
}));
