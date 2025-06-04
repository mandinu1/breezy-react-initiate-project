// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/services/api.ts
import axios from 'axios';
import { API_BASE_URL, PROVIDERS_CONFIG, RETAILERS_EXAMPLE } from '../constants';
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
    // Backend needs to know if it should use 'PROVINCE' or 'SALES_REGION'
    // For now, we assume backend /options/provinces handles this, or you might need separate endpoints/params
    // params.geoContext = salesView ? 'sales' : 'admin'; // Example: inform backend of context
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
    if (province && province !== 'all') params.province = province; // This should be the 'value' of the selected province
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
    const response = await apiClient.get('/options/ds-divisions', { params }); // Ensure this endpoint exists
    return response.data;
  } catch (error) {
    console.error("Failed to fetch DS Divisions:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchRetailers = async (filters: any): Promise<Retailer[]> => {
    console.log('Fetching retailers with filters (LIVE):', filters);
    try {
        // Construct params carefully, ensuring undefined are not sent if backend expects missing params
        const queryParams: any = {};
        if (filters.provider && filters.provider !== 'all') queryParams.provider = filters.provider;
        
        // Handle salesRegion/province and salesDistrict/district based on context if needed
        // Assuming 'province' and 'district' are the primary keys backend expects for geo-filtering retailers
        if (filters.province && filters.province !== 'all') queryParams.province = filters.province;
        else if (filters.salesRegion && filters.salesRegion !== 'all') queryParams.province = filters.salesRegion; // or salesRegion

        if (filters.district && filters.district !== 'all') queryParams.district = filters.district;
        else if (filters.salesDistrict && filters.salesDistrict !== 'all') queryParams.district = filters.salesDistrict; // or salesDistrict
        
        if (filters.dsDivision && filters.dsDivision !== 'all') queryParams.dsDivision = filters.dsDivision;
        if (filters.retailerId && filters.retailerId !== 'all') queryParams.retailerId = filters.retailerId;

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
    throw new Error("Image identifier is required to fetch image info.");
  }
  try {
    const response = await apiClient.get(`/image-info/${encodeURIComponent(imageIdentifier)}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch image info for identifier "${imageIdentifier}":`, error);
    throw new Error(`API error fetching image info for ${imageIdentifier}`);
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