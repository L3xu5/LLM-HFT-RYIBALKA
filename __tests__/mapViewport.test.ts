import { radiusKmForMapViewport } from '@/lib/mapViewport';

describe('radiusKmForMapViewport', () => {
  it('decreases radius as zoom increases', () => {
    const low = radiusKmForMapViewport(8, 55);
    const high = radiusKmForMapViewport(14, 55);
    expect(high).toBeLessThan(low);
  });

  it('clamps range to 0.4-400 km', () => {
    expect(radiusKmForMapViewport(2, 60)).toBeLessThanOrEqual(400);
    expect(radiusKmForMapViewport(19, 60)).toBeGreaterThanOrEqual(0.4);
  });

  it('increases radius for larger visible viewport', () => {
    const small = radiusKmForMapViewport(12, 55, 320, 320);
    const large = radiusKmForMapViewport(12, 55, 1200, 900);
    expect(large).toBeGreaterThan(small);
  });
});
