/**
 * Rough estimate of visible map radius (km) based on zoom level and latitude.
 * Uses about half of screen width in pixels as a typical map horizon.
 */
export function radiusKmForMapViewport(zoom: number, latDeg: number): number {
  const z = Math.min(19, Math.max(2, zoom));
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  const mpp = (156543.03392 * cosLat) / Math.pow(2, z);
  const halfWidthPx = 320;
  const km = ((mpp * halfWidthPx) / 1000) * 1.2;
  return Math.min(400, Math.max(5, km));
}
