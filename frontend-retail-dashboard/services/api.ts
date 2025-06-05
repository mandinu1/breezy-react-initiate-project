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
    let queryParams: any = { ...filters };
    if (filters.visibilityRange) {
      queryParams.visibilityRange = filters.visibilityRange.join(',');
    }
    const response = await apiClient.get('/posm/general', { params: queryParams });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch POSM general data:", error);
    return { data: [], count: 0, providerMetrics: [] };
  }
};

// Dynamic Filter Options Fetchers
export const fetchProvinces = async (provider?: string, salesView: boolean = false, context: 'board' | 'posm' = 'board', boardType?: string): Promise<FilterOption[]> => {
  console.log(`Fetching provinces (LIVE) for provider: ${provider}, context: ${context}, boardType: ${boardType}`);
  try {
    const params: any = { context };
    if (provider && provider !== 'all') params.provider = provider;
    if (context === 'board' && boardType && boardType !== 'all') params.boardType = boardType;
    const response = await apiClient.get('/options/provinces', { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch provinces:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchDistricts = async (provider?: string, province?: string, salesView: boolean = false, context: 'board' | 'posm' = 'board', boardType?: string): Promise<FilterOption[]> => {
  console.log(`Fetching districts (LIVE) for provider: ${provider}, province: ${province}, context: ${context}, boardType: ${boardType}`);
  try {
    const params: any = { context };
    if (provider && provider !== 'all') params.provider = provider;
    if (province && province !== 'all') params.province = province;
    if (context === 'board' && boardType && boardType !== 'all') params.boardType = boardType;
    const response = await apiClient.get('/options/districts', { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch districts:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchDsDivisions = async (provider?: string, province?: string, district?: string, context: 'board' | 'posm' = 'board', boardType?: string): Promise<FilterOption[]> => {
  console.log(`Fetching DS Divisions (LIVE) for provider: ${provider}, province: ${province}, district: ${district}, context: ${context}, boardType: ${boardType}`);
  try {
    const params: any = { context };
    if (provider && provider !== 'all') params.provider = provider;
    if (province && province !== 'all') params.province = province;
    if (district && district !== 'all') params.district = district;
    if (context === 'board' && boardType && boardType !== 'all') params.boardType = boardType;
    const response = await apiClient.get('/options/ds-divisions', { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch DS Divisions:", error);
    return [{ value: 'all', label: 'All (Error Loading)' }];
  }
};

export const fetchRetailers = async (filters: any, context: 'board' | 'posm' = 'board'): Promise<Retailer[]> => {
    console.log(`Fetching retailers with filters (LIVE) for ${context}:`, filters);
    try {
        const queryParams: any = { ...filters, context };
        // boardType is already part of 'filters' if passed from BoardView
        const response = await apiClient.get('/retailers', { params: queryParams });
        return response.data;
    } catch (error) {
        console.error("Failed to fetch retailers:", error);
        return [];
    }
};

// ... (rest of the API service file remains the same as provided in the previous step)
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

export const fetchImageInfo = async (imageIdentifier: string): Promise<ImageInfo> => {
  console.log('Fetching image info for identifier (LIVE):', imageIdentifier);
  if (!imageIdentifier) {
     return { id: 'placeholder', url: '/assets/sample-retailer-placeholder.png', type: 'placeholder' };
  }
  try {
    const response = await apiClient.get(`/image-info/${encodeURIComponent(imageIdentifier)}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch image info for identifier "${imageIdentifier}":`, error);
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