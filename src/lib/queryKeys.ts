export const queryKeys = {
  catches: ['catches'] as const,
  catch: (id: string) => ['catch', id] as const,
  profile: (userId: string) => ['profile', userId] as const,
};
