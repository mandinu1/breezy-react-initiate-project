
// Using string literals for enums to be more explicit and for easier debugging.
export type ViewMode = 'sales' | 'admin';
export type Page = 'board' | 'posm' | 'management';

export interface FilterOption {
  value: string;
  label: string;
}

export interface Retailer {
  id: string;
  name:string;
  latitude: number;
  longitude: number;
  imageIdentifier?: string; // For thumbnail on map popup AND for dedicated image display
  province?: string; // Optional: for filtering
  district?: string; // Optional: for filtering
}

export interface BoardData {
  id: string;
  retailerId: string;
  boardType: string;
  provider: string;
  // ... other board specific data
}

export interface PosmData {
  id: string;
  retailerId: string;
  provider: string;
  visibilityPercentage: number;
  // ... other POSM specific data
}

export interface ProviderConfig {
  value: string; // for filter values
  label: string; // for display in dropdowns
  name: string;  // for display in metrics, can be same as label
  key: string;   // unique key, e.g., 'dialog'
  color: string; // hex color
  logoUrl?: string; // URL for provider logo
}

export interface ProviderMetric {
  provider: string;
  count?: number;
  percentage?: number;
  logoUrl?: string; // Optional: To carry logo URL if needed for display with metric
}

export interface ImageInfo {
  id: string;
  url: string; // URL to the image
  type: 'original' | 'detected'; // Example type
}

// GeoJSON related types (simplified)
export interface GeoJsonFeature {
  type: "Feature";
  properties: { [key: string]: any };
  geometry: {
    type: string; // e.g., "Polygon", "MultiPolygon"
    coordinates: any[];
  };
}

export interface GeoJsonCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface BoardFiltersState {
  boardType: string;
  provider: string;
  salesRegion: string; // or province
  salesDistrict: string; // or district
  dsDivision: string;
  retailerId: string;
}

export interface PosmGeneralFiltersState {
  provider: string;
  province: string;
  district: string;
  dsDivision: string;
  retailerId:string;
  posmStatus: string; // 'All', 'Increase', 'Decrease'
  visibilityRange: [number, number]; // Changed to be non-optional, will default to [0, 100]
}

// Types for POSM Comparison
export interface PosmBatchShare {
  provider: string;
  percentage: number;
}

export interface PosmBatchDetails {
  image: string;
  shares: PosmBatchShare[];
  maxCapturePhase?: string; // Added for Batch 2
}

export interface PosmComparisonData {
  batch1: PosmBatchDetails;
  batch2: PosmBatchDetails;
  differences: { provider: string; diff: number }[];
}


// For Leaflet, if needed, but usually imported from @types/leaflet
// declare module 'leaflet' {
//   interface MapOptions {
//     // Add any custom options if extending Leaflet
//   }
// }
