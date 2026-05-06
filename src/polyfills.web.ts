/**
 * RN Web / Safari: part of Yandex Maps code reads global `TouchEvent`.
 * Without this shim you get ReferenceError and an empty map.
 */
const w = typeof window !== 'undefined' ? (window as unknown as { TouchEvent?: typeof MouseEvent }) : null;
if (w && typeof w.TouchEvent === 'undefined') {
  w.TouchEvent = window.MouseEvent;
}

export {};
