import { queryKeys } from '@/lib/queryKeys';

describe('queryKeys', () => {
  it('стабильные ключи для react-query', () => {
    expect(queryKeys.catches).toEqual(['catches']);
    expect(queryKeys.catch('abc')).toEqual(['catch', 'abc']);
    expect(queryKeys.profile('u')).toEqual(['profile', 'u']);
  });
});
