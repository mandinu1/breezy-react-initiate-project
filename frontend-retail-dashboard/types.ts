
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

// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/types.ts
export interface BoardData {
  id: string;                   // Unique ID for the board entry (e.g., IMAGE_REF_ID)
  retailerId: string;           // Corresponds to PROFILE_ID
  
  PROFILE_ID?: string;          // Raw data from source
  PROFILE_NAME?: string;
  PROVINCE?: string;
  DISTRICT?: string;
  DS_DIVISION?: string;
  GN_DIVISION?: string;
  SALES_DISTRICT?: string;
  SALES_AREA?: string;          // Make sure this column exists in your board.csv
  SALES_REGION?: string;

  // Board type and provider determined by backend logic
  boardType: string; 
  provider: string;  

  DIALOG_NAME_BOARD?: number;
  MOBITEL_NAME_BOARD?: number;
  HUTCH_NAME_BOARD?: number;
  AIRTEL_NAME_BOARD?: number;
  DIALOG_SIDE_BOARD?: number;
  MOBITEL_SIDE_BOARD?: number;
  HUTCH_SIDE_BOARD?: number;
  AIRTEL_SIDE_BOARD?: number;
  DIALOG_TIN_BOARD?: number;
  MOBITEL_TIN_BOARD?: number;
  HUTCH_TIN_BOARD?: number;
  AIRTEL_TIN_BOARD?: number;

  // For Dual Image Display (if you plan to use specific board images)
  originalBoardImageIdentifier?: string; 
  detectedBoardImageIdentifier?: string; 
  
  [key: string]: any; // Allows any other properties if needed for full flexibility
}

export interface PosmData {
  id: string;                   // Unique ID for the POSM entry
  retailerId: string;           // Corresponds to PROFILE_ID
  
  // Fields to be REMOVED from display as per your request:
  // provider: string;          // This was "Main Provider"
  // visibilityPercentage: number; // This was "Overall Visibility %"

  // Existing percentage columns (these are fine)
  DIALOG_AREA_PERCENTAGE?: number;
  AIRTEL_AREA_PERCENTAGE?: number;
  MOBITEL_AREA_PERCENTAGE?: number;
  HUTCH_AREA_PERCENTAGE?: number;

  // Fields to ADD to display as per your request:
  PROFILE_NAME?: string;
  PROVINCE?: string;
  DISTRICT?: string;
  DS_DIVISION?: string;
  GN_DIVISION?: string;
  SALES_REGION?: string;
  SALES_DISTRICT?: string;
  SALES_AREA?: string;      // Make sure this column exists in your posm.csv and is sent by backend

  // Retain these for other potential uses, even if not in table
  provider?: string; // Still useful for filtering or other logic
  visibilityPercentage?: number; // Still useful for filtering or other logic


  [key: string]: any; // For flexibility if backend sends more fields not strictly typed here
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
