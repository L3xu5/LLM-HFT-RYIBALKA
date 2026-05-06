/**
 * Estimate visible map radius (km) using zoom, latitude and current map viewport size.
 * Radius is half of viewport diagonal projected with meters-per-pixel.
 */
export function radiusKmForMapViewport(
  zoom: number,
  latDeg: number,
  widthPx = 640,
  heightPx = 640,
): number {
  const z = Math.min(19, Math.max(2, zoom));
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  const mpp = (156543.03392 * cosLat) / Math.pow(2, z);
  const w = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 640;
  const h = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 640;
  const halfDiagonalPx = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2);
  const km = ((mpp * halfDiagonalPx) / 1000) * 1.1;
  return Math.min(400, Math.max(0.4, km));
}
