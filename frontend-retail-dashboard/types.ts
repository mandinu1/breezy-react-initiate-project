// Using string literals for enums to be more explicit and for easier debugging.
export type ViewMode = 'sales' | 'admin';
export type Page = 'board' | 'posm' | 'management';

export interface FilterOption {
  value: string;
  label: string;
}

// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-0fa4c536d6929256228f28fa08a2914fae3eabac/frontend-retail-dashboard/types.ts
// Original Retailer interface was duplicated, keeping one.
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
  
  PROFILE_NAME?: string;
  PROVINCE?: string;
  DISTRICT?: string;
  DS_DIVISION?: string;
  GN_DIVISION?: string;
  SALES_REGION?: string;
  SALES_DISTRICT?: string;
  SALES_AREA?: string;

  DIALOG_AREA_PERCENTAGE?: number;
  AIRTEL_AREA_PERCENTAGE?: number;
  MOBITEL_AREA_PERCENTAGE?: number;
  HUTCH_AREA_PERCENTAGE?: number;

  provider?: string; 
  visibilityPercentage?: number; 

  originalPosmImageIdentifier?: string;
  detectedPosmImageIdentifier?: string;

  [key: string]: any; 
}

export interface ProviderConfig {
  value: string; 
  label: string; 
  name: string;  
  key: string;   
  color: string; 
  logoUrl?: string; 
}

export interface ProviderMetric {
  provider: string;
  count?: number;
  percentage?: number;
  logoUrl?: string; 
}

export interface ImageInfo {
  id: string;
  url: string; // URL to the image
  type: 'original' | 'detected' | 'placeholder' | 'error_placeholder' | 's3_presigned' | 'original_mock'; // Updated to include new types
}

// GeoJSON related types (simplified)
export interface GeoJsonFeature {
  type: "Feature";
  properties: { [key: string]: any };
  geometry: {
    type: string; 
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
  salesRegion: string; 
  salesDistrict: string; 
  dsDivision: string;
  retailerId: string;
}

export interface PosmGeneralFiltersState {
  provider: string;
  province: string;
  district: string;
  dsDivision: string;
  retailerId:string;
  posmStatus: string; 
  visibilityRange: [number, number]; 
}

// Types for POSM Comparison
export interface PosmBatchShare {
  provider: string;
  percentage: number;
}

export interface PosmBatchDetails {
  image: string;
  shares: PosmBatchShare[];
  maxCapturePhase?: string; 
}

export interface PosmComparisonData {
  batch1: PosmBatchDetails;
  batch2: PosmBatchDetails;
  differences: { provider: string; diff: number }[];
}
// Note: The Retailer interface was defined twice. I've kept one instance at the top.