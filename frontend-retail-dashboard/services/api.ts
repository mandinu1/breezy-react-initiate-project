// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-0fa4c536d6929256228f28fa08a2914fae3eabac/frontend-retail-dashboard/services/api.ts
import axios from 'axios';
import { API_BASE_URL } from '../constants';
import {
  Retailer,
  BoardData,
  PosmData,
  ImageInfo,
  GeoJsonCollection,
  FilterOption,
  BoardFiltersState,
  PosmGeneralFiltersState,
  ProviderMetric,
  PosmComparisonData
} from '../types';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Boards
export const fetchBoards = async (filters: Partial<BoardFiltersState>): Promise<{ data: BoardData[], count: number, providerMetrics: ProviderMetric[] }> => {
  console.log('Fetching boards with filters (LIVE):', filters);
  try {
    const response = await apiClient.get('/boards', { params: filters });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch boards:", error);
    return { data: [], count: 0, providerMetrics: [] };
  }
};

// POSM
export const fetchPosmGeneral = async (filters: Partial<PosmGeneralFiltersState>): Promise<{ data: PosmData[], count: number, providerMetrics: ProviderMetric[] }> => {
  console.log('Fetching POSM general data with filters (LIVE):', filters);
  try {
    const response = await apiClient.get('/posm/general', { params: filters });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch POSM general data:", error);
    return { data: [], count: 0, providerMetrics: [] };
  }
};

// Dynamic Filter Options Fetchers
export const fetchProvinces = async (provider?: string, salesView: boolean = false): Promise<FilterOption[]> => {
  console.log(`Fetching provinces (LIVE) for provider: ${provider}, salesView: ${salesView}`);
  try {
    const params: any = {};
    if (provider && provider !== 'all') params.provider = provider;
    // params.geoContext = salesView ? 'sales' : 'admin'; // Backend can infer from column names if needed
    const response = await apiClient.get('/options/provinces', { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch provinces:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchDistricts = async (provider?: string, province?: string, salesView: boolean = false): Promise<FilterOption[]> => {
  console.log(`Fetching districts (LIVE) for provider: ${provider}, province: ${province}, salesView: ${salesView}`);
  try {
    const params: any = {};
    if (provider && provider !== 'all') params.provider = provider;
    if (province && province !== 'all') params.province = province;
    // params.geoContext = salesView ? 'sales' : 'admin';
    const response = await apiClient.get('/options/districts', { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch districts:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchDsDivisions = async (provider?: string, province?: string, district?: string): Promise<FilterOption[]> => {
  console.log(`Fetching DS Divisions (LIVE) for provider: ${provider}, province: ${province}, district: ${district}`);
  try {
    const params: any = {};
    if (provider && provider !== 'all') params.provider = provider;
    if (province && province !== 'all') params.province = province;
    if (district && district !== 'all') params.district = district;
    const response = await apiClient.get('/options/ds-divisions', { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch DS Divisions:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchRetailers = async (filters: any): Promise<Retailer[]> => {
    console.log('Fetching retailers with filters (LIVE):', filters);
    try {
        const queryParams: any = {};
        if (filters.provider && filters.provider !== 'all') queryParams.provider = filters.provider;
        
        // Use specific keys from BoardFiltersState or PosmGeneralFiltersState
        // For BoardView, this might be salesRegion/salesDistrict.
        // For POSMView, this might be province/district.
        // The backend /retailers endpoint needs to handle these potentially different keys
        // or the frontend needs to map them to consistent query params.
        // Let's assume backend /retailers expects 'province' and 'district' for geo.
        // And also 'salesRegion' and 'salesDistrict' as aliases.

        if (filters.province && filters.province !== 'all') queryParams.province = filters.province;
        else if (filters.salesRegion && filters.salesRegion !== 'all') queryParams.salesRegion = filters.salesRegion;

        if (filters.district && filters.district !== 'all') queryParams.district = filters.district;
        else if (filters.salesDistrict && filters.salesDistrict !== 'all') queryParams.salesDistrict = filters.salesDistrict;
        
        if (filters.dsDivision && filters.dsDivision !== 'all') queryParams.dsDivision = filters.dsDivision;
        
        // If retailerId is passed, it's usually for fetching a specific retailer, not a list.
        // However, if the intention is to filter a list *potentially* down to one, it can be included.
        // For fetching dropdown options, retailerId is usually not part of the filters to get the list.
        // If it IS part of filters to get the list, it implies the list itself could be pre-filtered.
        // The current use in BoardView.tsx's useEffect for retailerFilterOptions doesn't pass retailerId.
        // This is fine.

        const response = await apiClient.get('/retailers', { params: queryParams });
        return response.data;
    } catch (error) {
        console.error("Failed to fetch retailers:", error);
        return [];
    }
};


// --- Other existing API functions (fetchPosmComparisonData, fetchAvailableBatches, fetchImageInfo, fetchGeoDistricts etc.) ---
// Ensure they are correctly implemented to call backend or are intentionally mock.

// Mock API delay (can be removed if no functions use it anymore)
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchPosmComparisonData = async (profileId: string, batch1Id: string, batch2Id: string): Promise<PosmComparisonData> => {
  console.log('Fetching POSM comparison for profile (LIVE):', profileId, 'batches:', batch1Id, batch2Id);
  try {
    const response = await apiClient.get('/posm/comparison', {
      params: { profileId, batch1Id, batch2Id }
    });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch POSM comparison data:", error);
    const emptyShares = [{ provider: "Error", percentage: 0 }];
    const emptyBatchDetails = { image: "/assets/sample-retailer-placeholder.png", shares: emptyShares };
    return {
      batch1: emptyBatchDetails,
      batch2: emptyBatchDetails,
      differences: [{ provider: "Error", diff: 0 }]
    };
  }
};

export const fetchAvailableBatches = async (profileId: string): Promise<FilterOption[]> => {
    console.log('Fetching available batches for profile ID (LIVE):', profileId);
    if (!profileId || profileId === 'all') {
        return [];
    }
    try {
        const response = await apiClient.get(`/posm/available-batches/${profileId}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch available batches for profile ${profileId}:`, error);
        return [];
    }
};

export const fetchSummary = async (profileId: string): Promise<any> => {
  console.log('Fetching summary for profile (MOCK - no backend endpoint):', profileId);
  await mockDelay(500);
  return { retailerName: `Retailer ${profileId.slice(0,3)} Mart (Mock)`, totalBoards: Math.floor(Math.random() * 10), totalPosmItems: Math.floor(Math.random() * 200), overallVisibility: Math.floor(Math.random() * 100) };
};

export const fetchImageInfo = async (imageIdentifier: string): Promise<ImageInfo> => {
  console.log('Fetching image info for identifier (LIVE):', imageIdentifier);
  if (!imageIdentifier) {
    // Return a placeholder or throw, depending on how ImageDisplay handles it
    // throw new Error("Image identifier is required to fetch image info.");
     return { id: 'placeholder', url: '/assets/sample-retailer-placeholder.png', type: 'placeholder' };
  }
  try {
    // The backend /image-info/{image_identifier} should handle S3 ARN or other IDs
    const response = await apiClient.get(`/image-info/${encodeURIComponent(imageIdentifier)}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch image info for identifier "${imageIdentifier}":`, error);
    // throw new Error(`API error fetching image info for ${imageIdentifier}`);
    return { id: imageIdentifier, url: '/assets/sample-retailer-placeholder.png', type: 'error_placeholder' };
  }
};

export const fetchGeoDistricts = async (): Promise<GeoJsonCollection> => {
  console.log('Fetching GeoJSON for districts (LIVE)');
  try {
    const response = await apiClient.get('/geo/districts');
    return response.data;
  } catch (error) {
    console.error("Failed to fetch GeoJSON districts:", error);
    return { type: "FeatureCollection", features: [] };
  }
};

export const fetchGeoDsd = async (): Promise<GeoJsonCollection> => {
  console.log('Fetching GeoJSON for DSDs (MOCK - no backend endpoint)');
  await mockDelay(500);
  return { type: "FeatureCollection", features: [] };
};