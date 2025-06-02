
import axios from 'axios';
import { API_BASE_URL, PROVIDERS_CONFIG } from '../constants'; // Import PROVIDERS_CONFIG
import { Retailer, BoardData, PosmData, ImageInfo, GeoJsonCollection, FilterOption, BoardFiltersState, PosmGeneralFiltersState, ProviderMetric, PosmComparisonData } from '../types';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock API delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get a provider name based on config (excluding 'all')
const getRandomProviderName = () => {
    const actualProviders = PROVIDERS_CONFIG.filter(p => p.key !== 'all');
    return actualProviders[Math.floor(Math.random() * actualProviders.length)].name;
}

// Boards
export const fetchBoards = async (filters: Partial<BoardFiltersState>): Promise<{ data: BoardData[], count: number, providerMetrics: ProviderMetric[] }> => {
  console.log('Fetching boards with filters:', filters);
  await mockDelay(1000);
  
  let mockBoards: BoardData[] = Array.from({length: Math.floor(Math.random()*20)+15}).map((_, i) => ({
      id: `board${i+1}`,
      retailerId: `ret${(i%10)+1}`, // Match retailer IDs from fetchRetailers
      boardType: filters.boardType && filters.boardType !== 'all' ? filters.boardType! : ['dealer', 'tin', 'vertical'][i%3],
      provider: filters.provider && filters.provider !== 'all' ? PROVIDERS_CONFIG.find(p=>p.value === filters.provider)?.name || getRandomProviderName() : getRandomProviderName(),
  }));

  if(filters.retailerId && filters.retailerId !== 'all') {
      mockBoards = mockBoards.filter(b => b.retailerId === filters.retailerId);
  }
  // Add filtering by salesRegion (province), salesDistrict, dsDivision if present
  // This mock API currently doesn't use province/district/dsDivision from filters to filter boards, but it should in a real scenario.
  // For retailers, it does.


  const providerCounts: {[key:string]: number} = {};
  PROVIDERS_CONFIG.filter(p => p.key !== 'all').forEach(p => providerCounts[p.name] = 0);

  mockBoards.forEach(board => {
      if(providerCounts[board.provider] !== undefined) {
          providerCounts[board.provider]++;
      }
  });
  
  const mockProviderMetrics: ProviderMetric[] = PROVIDERS_CONFIG
    .filter(p => p.key !== 'all')
    .map(pConfig => ({
      provider: pConfig.name,
      count: providerCounts[pConfig.name] || 0
  }));

  return { data: mockBoards, count: mockBoards.length, providerMetrics: mockProviderMetrics };
};

// POSM
export const fetchPosmGeneral = async (filters: Partial<PosmGeneralFiltersState>): Promise<{ data: PosmData[], count: number, providerMetrics: ProviderMetric[] }> => {
  console.log('Fetching POSM general data with filters:', filters);
  await mockDelay(1000);

  let mockPosmDataAll: PosmData[] = Array.from({length: Math.floor(Math.random()*30)+20}).map((_, i) => ({
      id: `posm${i+1}`,
      retailerId: `ret${(i%10)+1}`, // Match retailer IDs
      provider: filters.provider && filters.provider !== 'all' ? PROVIDERS_CONFIG.find(p=>p.value === filters.provider)?.name || getRandomProviderName() : getRandomProviderName(),
      visibilityPercentage: Math.floor(Math.random()*100)
  }));

  let filteredPosmData = [...mockPosmDataAll];

  if(filters.retailerId && filters.retailerId !== 'all') {
      filteredPosmData = filteredPosmData.filter(p => p.retailerId === filters.retailerId);
  }
  // Add filtering by province, district, dsDivision to Posm data if present in filters
  // This mock API currently doesn't use province/district/dsDivision from filters to filter POSM data, but it should in a real scenario.


  // Apply visibilityRange filter if a specific provider is selected
  if (filters.provider && filters.provider !== 'all' && filters.visibilityRange) {
    const [minVis, maxVis] = filters.visibilityRange;
    filteredPosmData = filteredPosmData.filter(p => 
        p.provider === PROVIDERS_CONFIG.find(prov => prov.value === filters.provider)?.name &&
        p.visibilityPercentage >= minVis && p.visibilityPercentage <= maxVis
    );
  } else if (filters.provider && filters.provider !== 'all') {
    // Filter by provider only if no range is specified (or range is full)
     filteredPosmData = filteredPosmData.filter(p => 
        p.provider === PROVIDERS_CONFIG.find(prov => prov.value === filters.provider)?.name
    );
  }
  // Note: POSM status filter not implemented in mock logic yet


  const providerPercentages: {[key:string]: {totalPercentage: number, count: number}} = {};
  PROVIDERS_CONFIG.filter(p => p.key !== 'all').forEach(p => providerPercentages[p.name] = {totalPercentage: 0, count: 0});

  const dataForMetricsCalculation = (filters.provider && filters.provider !== 'all') 
                                   ? filteredPosmData 
                                   : mockPosmDataAll;


  dataForMetricsCalculation.forEach(posm => {
      if(providerPercentages[posm.provider]){
          providerPercentages[posm.provider].totalPercentage += posm.visibilityPercentage;
          providerPercentages[posm.provider].count++;
      }
  });

  const mockProviderMetrics: ProviderMetric[] = PROVIDERS_CONFIG
    .filter(p => p.key !== 'all')
    .map(pConfig => {
        const stats = providerPercentages[pConfig.name];
        const averagePercentage = stats && stats.count > 0 ? stats.totalPercentage / stats.count : 0; // Default to 0 if no data
        return {
            provider: pConfig.name,
            percentage: parseFloat(averagePercentage.toFixed(1))
        };
  });

  return { data: filteredPosmData, count: filteredPosmData.length, providerMetrics: mockProviderMetrics };
};

const randomProviderShares = () => {
    const actualProviders = PROVIDERS_CONFIG.filter(p => p.key !== 'all' && p.name);
    if (actualProviders.length === 0) return [{ provider: "Default", percentage: 100}]; // Fallback if no providers

    // Shuffle and select 1 to 4 providers (or fewer if not available, but at least 1)
    const shuffledProviders = [...actualProviders].sort(() => 0.5 - Math.random());
    // Ensure at least 1 provider, up to 4 or total available
    const numProvidersToSelect = Math.max(1, Math.min(actualProviders.length, Math.floor(Math.random() * Math.min(actualProviders.length, 4)) + 1));
    const selectedProviders = shuffledProviders.slice(0, numProvidersToSelect);
    
    if (selectedProviders.length === 0) return [{ provider: "DefaultFallback", percentage: 100}];


    let percentages = [];
    let sumForNormalization = 0;
    for (let i = 0; i < selectedProviders.length; i++) {
        // Assign a random value, ensuring it's at least a small positive number to avoid zero sum if all randoms are too small
        let val = Math.random() + 0.01; 
        percentages.push(val);
        sumForNormalization += val;
    }

    const shares = percentages.map(p => Math.round((p / sumForNormalization) * 100));
    
    let currentSum = shares.reduce((acc, val) => acc + val, 0);
    let diff = 100 - currentSum;

    // Distribute rounding difference
    if (diff !== 0 && shares.length > 0) {
        // Try to add/subtract from a share that won't go negative or excessively large
        let  idxToAdjust = shares.findIndex(s => s + diff >= 0);
        if (idxToAdjust === -1 && diff > 0) idxToAdjust = 0; // If all would go negative by subtraction, add to first for positive diff

        if (idxToAdjust !== -1) {
            shares[idxToAdjust] += diff;
        } else { // fallback if complex adjustment fails, usually if diff is too negative for all shares
            // This case is rare, but as a last resort, re-distribute to make sum 100 if possible
            // For mock data, simply adding to the first might be okay if others become 0
             if (shares[0] !== undefined) shares[0] += diff;
        }
    }
    
    // Ensure no negative percentages and clean up if any share became 0
    let finalShares = selectedProviders.map((provider, index) => ({
        provider: provider.name,
        percentage: Math.max(0, shares[index] || 0) // Ensure non-negative
    }));

    // If sum is still not 100 due to cleanups (e.g. all became 0), give 100% to the first selected provider
    const finalSum = finalShares.reduce((acc, s) => acc + s.percentage, 0);
    if (finalSum === 0 && finalShares.length > 0) {
        finalShares[0].percentage = 100;
    } else if (finalSum !== 100 && finalShares.length > 0) {
        // Last pass to fix sum if it's not 100, add diff to the first element
        const finalDiff = 100 - finalSum;
        finalShares[0].percentage += finalDiff;
        finalShares[0].percentage = Math.max(0, finalShares[0].percentage); // clamp
    }
    
    return finalShares.filter(s => s.percentage > 0);
};


export const fetchPosmComparisonData = async (profileId: string, batch1Id: string, batch2Id: string): Promise<PosmComparisonData> => {
  console.log('Fetching POSM comparison for profile:', profileId, 'batches:', batch1Id, batch2Id);
  await mockDelay(1000);
  
  const batch1Shares = randomProviderShares();
  const batch2Shares = randomProviderShares();
  const mockCapturePhases = ["Initial Survey", "Data Verification", "Final Review", "Analysis Complete"];


  const differences: {provider: string, diff: number}[] = [];
  const allProvidersInComparison = new Set([...batch1Shares.map(s=>s.provider), ...batch2Shares.map(s=>s.provider)]);

  allProvidersInComparison.forEach(providerName => {
      const b1Share = batch1Shares.find(s=>s.provider === providerName)?.percentage || 0;
      const b2Share = batch2Shares.find(s=>s.provider === providerName)?.percentage || 0;
      differences.push({provider: providerName, diff: parseFloat((b2Share - b1Share).toFixed(1)) });
  });


  return {
    batch1: { image: `https://picsum.photos/seed/${profileId}_${batch1Id}/300/200`, shares: batch1Shares },
    batch2: { 
        image: `https://picsum.photos/seed/${profileId}_${batch2Id}/300/200`, 
        shares: batch2Shares, 
        maxCapturePhase: mockCapturePhases[Math.floor(Math.random() * mockCapturePhases.length)] 
    },
    differences: differences
  };
};

export const fetchAvailableBatches = async (profileId: string): Promise<FilterOption[]> => {
    console.log('Fetching available batches for profile ID:', profileId);
    await mockDelay(500);
    if (!profileId || profileId === 'all') return [];
    // Simulate different batches for different retailers
    const baseBatches = [
        { value: 'batch1_2023_q1', label: '2023 Q1'},
        { value: 'batch2_2023_q2', label: '2023 Q2'},
        { value: 'batch3_2023_q3', label: '2023 Q3'},
        { value: 'batch4_2023_q4', label: '2023 Q4'},
        { value: 'batch5_2024_q1', label: '2024 Q1'},
    ];
    // Simple hash to vary batch availability slightly per retailer
    const profileHash = profileId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return baseBatches.slice(profileHash % 2, (profileHash % 2) + 3 + (profileHash % 3)); // Return 3 to 5 batches
};


// Summary (Example, adjust as needed)
export const fetchSummary = async (profileId: string): Promise<any> => {
  console.log('Fetching summary for profile:', profileId);
  await mockDelay(1000);
  return { retailerName: 'Super Mart', totalBoards: 5, totalPosmItems: 120, overallVisibility: 75 };
};

// Images
export const fetchImageInfo = async (imageIdentifier: string): Promise<ImageInfo> => {
  console.log('Fetching image info for identifier:', imageIdentifier);
  if (!imageIdentifier) {
    return Promise.reject(new Error("No image identifier provided"));
  }
  await mockDelay(500);
  // Ensure imageIdentifier is dynamic in URL
  return { id: imageIdentifier, url: `https://picsum.photos/seed/${encodeURIComponent(imageIdentifier)}/400/300`, type: 'original' };
};


// Geo Data
export const fetchGeoDistricts = async (): Promise<GeoJsonCollection> => {
  console.log('Fetching GeoJSON for districts');
  await mockDelay(1000);
  return {
    type: "FeatureCollection",
    features: [ 
      { type: "Feature", properties: { name: "Colombo", value: Math.random()*100, ISO_1: "LK-11" }, geometry: { type: "Polygon", coordinates: [[[79.83, 7.0],[79.83, 6.8],[80.0, 6.8],[80.0, 7.0],[79.83, 7.0]]] } },
      { type: "Feature", properties: { name: "Kandy", value: Math.random()*100, ISO_1: "LK-21" }, geometry: { type: "Polygon", coordinates: [[[80.5, 7.4],[80.5, 7.1],[80.7, 7.1],[80.7, 7.4],[80.5, 7.4]]] } },
      { type: "Feature", properties: { name: "Galle", value: Math.random()*100, ISO_1: "LK-31" }, geometry: { type: "Polygon", coordinates: [[[80.1, 6.2],[80.1, 6.0],[80.3, 6.0],[80.3, 6.2],[80.1, 6.2]]] } },
    ]
  };
};

export const fetchGeoDsd = async (): Promise<GeoJsonCollection> => {
  console.log('Fetching GeoJSON for DSDs');
  await mockDelay(1000);
  return { type: "FeatureCollection", features: [] }; // Placeholder
};

// Generic data fetching for dropdowns - these would ideally be specific endpoints
export const fetchFilterOptions = async (type: 'provinces' | 'districts' | 'dsdivisions' | 'retailers', parentId?: string): Promise<FilterOption[]> => {
  console.log(`Fetching options for ${type}`, parentId ? `with parent ${parentId}` : '');
  await mockDelay(300);
  if (type === 'retailers') { // This matches RETAILERS_EXAMPLE, ensure IDs are consistent
    return [ // RETAILERS_EXAMPLE is now definitive and imported from constants
        {value: 'all', label: 'All Retailers'},
        {value: 'ret1', label: 'Alpha Super (Colombo)'},
        {value: 'ret2', label: 'Beta Foods (Gampaha)'},
        {value: 'ret3', label: 'Gamma Groceries (Kandy)'},
        {value: 'ret4', label: 'Delta Mart (Galle)'},
        {value: 'ret5', label: 'Epsilon Store (Colombo)'},
        {value: 'ret6', label: 'Zeta Wholesales (Matale)'},
        {value: 'ret7', label: 'Eta Retail (Matara)'},
        // Add more if your mapRetailers list is longer
    ];
  }
  return [{value: 'all', label: `All ${type}`}];
};

export const fetchRetailers = async (filters: any): Promise<Retailer[]> => {
    console.log('Fetching retailers with filters:', filters);
    await mockDelay(700);
    
    let mockedRetailers: Retailer[] = [
        { id: 'ret1', name: 'Alpha Super', province: 'western', district: 'colombo', imageIdentifier: 'ret1_shop_image', latitude: 6.9271, longitude: 79.8612 },
        { id: 'ret2', name: 'Beta Foods', province: 'western', district: 'gampaha', imageIdentifier: 'ret2_shop_image', latitude: 7.0920, longitude: 79.9980 },
        { id: 'ret3', name: 'Gamma Groceries', province: 'central', district: 'kandy', imageIdentifier: 'ret3_shop_image', latitude: 7.2906, longitude: 80.6337 },
        { id: 'ret4', name: 'Delta Mart', province: 'southern', district: 'galle', imageIdentifier: 'ret4_shop_image', latitude: 6.0535, longitude: 80.2210 },
        { id: 'ret5', name: 'Epsilon Store', province: 'western', district: 'colombo', imageIdentifier: 'ret5_shop_image', latitude: 6.8523, longitude: 79.9000 },
        { id: 'ret6', name: 'Zeta Wholesales', province: 'central', district: 'matale', latitude: 7.4675, longitude: 80.6234 /* No image */ },
        { id: 'ret7', name: 'Eta Retail', province: 'southern', district: 'matara', imageIdentifier: 'ret7_shop_image', latitude: 5.9487, longitude: 80.5422 },
        { id: 'ret8', name: 'Theta General', province: 'western', district: 'kalutara', imageIdentifier: 'ret8_shop_image', latitude: 6.5854, longitude: 79.9612 },
        { id: 'ret9', name: 'Iota Supplies', province: 'central', district: 'nuwaraeliya', latitude: 6.9687, longitude: 80.7718 },
        { id: 'ret10', name: 'Kappa Corner', province: 'southern', district: 'hambantota', imageIdentifier: 'ret10_shop_image', latitude: 6.1246, longitude: 81.1185 },
    ];

    let result = [...mockedRetailers];

    if(filters) {
        // Province (salesRegion) filter
        if(filters.province && filters.province !== 'all') {
            result = result.filter(r => r.province === filters.province);
        } else if (filters.salesRegion && filters.salesRegion !== 'all') { // Alias for BoardView
             result = result.filter(r => r.province === filters.salesRegion);
        }

        // District (salesDistrict) filter
        if(filters.district && filters.district !== 'all') {
             result = result.filter(r => r.district === filters.district);
        } else if (filters.salesDistrict && filters.salesDistrict !== 'all') { // Alias for BoardView
             result = result.filter(r => r.district === filters.salesDistrict);
        }
        // DS Division filter (Note: Retailer mock data doesn't have dsDivision, so this won't filter anything yet)
        // if(filters.dsDivision && filters.dsDivision !== 'all') {
        //     result = result.filter(r => r.dsDivision === filters.dsDivision);
        // }
        
        if (filters.retailerId && filters.retailerId !== 'all') {
            result = result.filter(r => r.id === filters.retailerId);
        }
    }
    return result;
};

// RETAILERS_DROPDOWN_OPTIONS is effectively RETAILERS_EXAMPLE from constants.ts
// Ensure RETAILERS_EXAMPLE in constants.ts uses these IDs ('ret1', 'ret2', etc.)
// For now, RETAILERS_EXAMPLE from constants.ts will be used directly in views.
