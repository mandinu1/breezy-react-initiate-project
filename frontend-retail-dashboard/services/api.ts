import axios from 'axios';
import { API_BASE_URL, PROVIDERS_CONFIG, RETAILERS_EXAMPLE } from '../constants'; // RETAILERS_EXAMPLE is used in a mock
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
  baseURL: API_BASE_URL, // This will make requests to /api/... via Vite proxy
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to get a provider name based on config (excluding 'all')
// This might still be used by some mock logic if not all functions are updated, or if backend needs specific names
const getRandomProviderName = () => {
    const actualProviders = PROVIDERS_CONFIG.filter(p => p.key !== 'all');
    return actualProviders[Math.floor(Math.random() * actualProviders.length)].name;
}

// Boards
export const fetchBoards = async (filters: Partial<BoardFiltersState>): Promise<{ data: BoardData[], count: number, providerMetrics: ProviderMetric[] }> => {
  console.log('Fetching boards with filters (LIVE):', filters);
  try {
    const response = await apiClient.get('/boards', { params: filters });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch boards:", error);
    return { data: [], count: 0, providerMetrics: [] }; // Return a default empty state
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

export const fetchPosmComparisonData = async (profileId: string, batch1Id: string, batch2Id: string): Promise<PosmComparisonData> => {
  console.log('Fetching POSM comparison for profile (LIVE):', profileId, 'batches:', batch1Id, batch2Id);
  try {
    const response = await apiClient.get('/posm/comparison', {
      params: { profileId, batch1Id, batch2Id }
    });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch POSM comparison data:", error);
    // Return a default/empty structure matching PosmComparisonData
    // This might need adjustment based on how your component handles errors
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
    if (!profileId || profileId === 'all') return [];
    try {
        const response = await apiClient.get(`/posm/available-batches/${profileId}`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch available batches:", error);
        return [];
    }
};


// Summary (Example, adjust as needed - MOCK REMAINS FOR NOW)
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)); // Kept for any remaining mocks
export const fetchSummary = async (profileId: string): Promise<any> => {
  console.log('Fetching summary for profile (MOCK):', profileId);
  await mockDelay(1000);
  // This would be an API call in a real scenario, e.g., apiClient.get(`/summary/${profileId}`)
  return { retailerName: `Retailer ${profileId.slice(0,3)} Mart`, totalBoards: Math.floor(Math.random() * 10), totalPosmItems: Math.floor(Math.random() * 200), overallVisibility: Math.floor(Math.random() * 100) };
};

// Images
export const fetchImageInfo = async (imageIdentifier: string): Promise<ImageInfo> => {
  console.log('Fetching image info for identifier (LIVE):', imageIdentifier);
  if (!imageIdentifier) {
    // Throw an error if no identifier is provided
    throw new Error("Image identifier is required.");
  }
  try {
    // Assuming imageIdentifier can be an S3 ARN or a seed for picsum based on backend logic
    const response = await apiClient.get(`/image-info/${encodeURIComponent(imageIdentifier)}`);
    // Ensure the response.data matches the ImageInfo type from the backend
    // If your backend might not return a 'type' that is strictly 'original' | 'detected',
    // you might need to validate or transform response.data here.
    // For now, we assume the backend /image-info/{identifier} endpoint returns valid ImageInfo.
    return response.data;
  } catch (error) {
    console.error("Failed to fetch image info from API:", error);
    // Re-throw the error or throw a new custom error
    // This will be caught by the .catch() block in ImageDisplay.tsx
    throw new Error(`Failed to fetch image info for identifier: ${imageIdentifier}`);
  }
};

// Geo Data
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

// GeoDsd - MOCK REMAINS FOR NOW as no backend endpoint was defined
export const fetchGeoDsd = async (): Promise<GeoJsonCollection> => {
  console.log('Fetching GeoJSON for DSDs (MOCK)');
  await mockDelay(1000);
  return { type: "FeatureCollection", features: [] }; // Placeholder
};

// Generic data fetching for dropdowns - these would ideally be specific endpoints
// fetchFilterOptions (for provinces, districts, dsdivisions) - MOCK REMAINS FOR NOW
export const fetchFilterOptions = async (type: 'provinces' | 'districts' | 'dsdivisions' | 'retailers', parentId?: string): Promise<FilterOption[]> => {
  console.log(`Fetching options for ${type} (MOCK for non-retailers)`, parentId ? `with parent ${parentId}` : '');
  await mockDelay(300);
  if (type === 'retailers') {
    // This part is now handled by fetchRetailers.
    // Returning a default or empty array, or you can call fetchRetailers if structure matches.
    // For simplicity, using the hardcoded example from constants if this specific call is still made.
    return RETAILERS_EXAMPLE;
  }
  // Mock data for other types as before, or indicate they should be fetched if backend supports
  const MOCK_PROVINCES = [ { value: 'all', label: 'All Provinces' }, { value: 'western', label: 'Western' }];
  const MOCK_DISTRICTS = [ { value: 'all', label: 'All Districts' }, { value: 'colombo', label: 'Colombo' }];
  const MOCK_DSDIVISIONS = [ { value: 'all', label: 'All DS Divisions' }, { value: 'colombo_ds1', label: 'Colombo DS1'}];

  if (type === 'provinces') return MOCK_PROVINCES;
  if (type === 'districts') return MOCK_DISTRICTS;
  if (type === 'dsdivisions') return MOCK_DSDIVISIONS;
  
  return [{value: 'all', label: `All ${type}`}];
};

export const fetchRetailers = async (filters: any): Promise<Retailer[]> => {
    console.log('Fetching retailers with filters (LIVE):', filters);
    try {
        const response = await apiClient.get('/retailers', { params: filters });
        return response.data;
    } catch (error) {
        console.error("Failed to fetch retailers:", error);
        return [];
    }
};