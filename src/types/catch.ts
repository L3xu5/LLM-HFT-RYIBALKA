export type CatchPhoto = {
  id: string;
  catch_id: string;
  storage_path: string;
};

export type CatchRow = {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  fish_species: string | null;
  weight_g: number | null;
  bait: string | null;
  gear: string | null;
  notes: string | null;
  caught_at: string;
  is_public: boolean;
  created_at: string;
};

export type CatchWithPhotos = CatchRow & {
  catch_photos: CatchPhoto[];
  author_name?: string | null;
};

export type LatLng = { lat: number; lng: number };

export type RecommendationResponse = {
  lat: number;
  lng: number;
  reason: string;
  suggested_bait?: string | null;
  suggested_species?: string | null;
  confidence?: number;
  assumptions?: string[];
  nearby_evidence?: string[];
  sources?: string[];
  diagnostics?: {
    attempts?: Array<{
      source: 'overpass' | 'nominatim';
      around: 'center' | 'model';
      radius_km: number;
      hits?: number;
    }>;
    filtered_catches_in_radius?: number;
    fallback_mode?: 'best_effort_model_or_center';
    snapped_to_water?: boolean;
    used_water_points?: number;
    external_water_points?: number;
  };
};
