export type MapMarkerVm = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** theme palette color keyword supported by Yandex default markers */
  color: string;
};

/** Visible map area center and current zoom (from YMapListener). */
export type MapViewport = {
  lat: number;
  lng: number;
  zoom: number;
};

export type YandexMapHandle = {
  setCamera: (lat: number, lng: number, zoom?: number) => void;
  /** Adjust zoom by one step (for example +1 / -1). */
  adjustZoom: (delta: number) => void;
  /** Current screen center and zoom (the area currently viewed by the user). */
  getViewport: () => Promise<MapViewport>;
};
