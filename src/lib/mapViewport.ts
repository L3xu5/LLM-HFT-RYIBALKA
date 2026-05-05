/**
 * Грубая оценка радиуса видимой области карты (км) по уровню zoom и широте.
 * Использует ~половину ширины экрана в пикселях как типичный горизонт карты.
 */
export function radiusKmForMapViewport(zoom: number, latDeg: number): number {
  const z = Math.min(19, Math.max(2, zoom));
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  const mpp = (156543.03392 * cosLat) / Math.pow(2, z);
  const halfWidthPx = 320;
  const km = ((mpp * halfWidthPx) / 1000) * 1.2;
  return Math.min(400, Math.max(5, km));
}
