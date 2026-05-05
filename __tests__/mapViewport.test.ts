import { radiusKmForMapViewport } from '@/lib/mapViewport';

describe('radiusKmForMapViewport', () => {
  it('уменьшает радиус при большем zoom', () => {
    const low = radiusKmForMapViewport(8, 55);
    const high = radiusKmForMapViewport(14, 55);
    expect(high).toBeLessThan(low);
  });

  it('ограничивает диапазон 5–400 км', () => {
    expect(radiusKmForMapViewport(2, 60)).toBeLessThanOrEqual(400);
    expect(radiusKmForMapViewport(19, 60)).toBeGreaterThanOrEqual(5);
  });
});
