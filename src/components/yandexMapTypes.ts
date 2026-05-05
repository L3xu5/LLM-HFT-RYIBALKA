export type MapMarkerVm = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** theme palette color keyword supported by Yandex default markers */
  color: string;
};

/** Центр видимой области карты и текущий zoom (из YMapListener). */
export type MapViewport = {
  lat: number;
  lng: number;
  zoom: number;
};

export type YandexMapHandle = {
  setCamera: (lat: number, lng: number, zoom?: number) => void;
  /** Изменить масштаб на шаг (например +1 / −1). */
  adjustZoom: (delta: number) => void;
  /** Текущий центр экрана и масштаб (область, на которую смотрит пользователь). */
  getViewport: () => Promise<MapViewport>;
};
