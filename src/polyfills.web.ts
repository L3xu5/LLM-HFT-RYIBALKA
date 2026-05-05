/**
 * RN Web / Safari: часть кода Яндекс.Карт обращается к глобальному `TouchEvent`.
 * Без заглушки — ReferenceError и пустая карта.
 */
const w = typeof window !== 'undefined' ? (window as unknown as { TouchEvent?: typeof MouseEvent }) : null;
if (w && typeof w.TouchEvent === 'undefined') {
  w.TouchEvent = window.MouseEvent;
}

export {};
