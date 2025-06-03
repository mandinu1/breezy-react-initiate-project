
import { FilterOption, ProviderConfig } from './types'; // Updated import

export const API_BASE_URL = '/api'; // Replace with actual backend URL if different

// ProviderConfig interface is now in types.ts

export const PROVIDERS_CONFIG: ProviderConfig[] = [
  { value: 'all', label: 'All Providers', name: 'All', key: 'all', color: '#718096' }, // Gray for 'All'
  { value: 'dialog', label: 'Dialog', name: 'Dialog', key: 'dialog', color: '#bb1118', logoUrl: '/assets/provider-logos/Dialog.png' },
  { value: 'mobitel', label: 'Mobitel', name: 'Mobitel', key: 'mobitel', color: '#53ba4e', logoUrl: '/assets/provider-logos/mobitel.jpg' },
  { value: 'airtel', label: 'Airtel', name: 'Airtel', key: 'airtel', color: '#ed1b25', logoUrl: '/assets/provider-logos/airtel.png' },
  { value: 'hutch', label: 'Hutch', name: 'Hutch', key: 'hutch', color: '#ff6b08', logoUrl: '/assets/provider-logos/hutch.png' },
];

// Derived from PROVIDERS_CONFIG for use in SelectDropdown components
export const PROVIDER_FILTER_OPTIONS: FilterOption[] = PROVIDERS_CONFIG.map(p => ({ value: p.value, label: p.label }));


export const BOARD_TYPES: FilterOption[] = [
  // { value: 'all', label: 'All Board Types' }, // Removed as per request
  { value: 'dealer', label: 'Dealer Board' },
  { value: 'tin', label: 'Tin Plate' },
  { value: 'vertical', label: 'Vertical Board' },
];

export const POSM_STATUSES: FilterOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'increase', label: 'Increase' },
  { value: 'decrease', label: 'Decrease' },
  { value: 'stable', label: 'Stable' },
];

// Example static data for dropdowns - in a real app, fetch this from API
export const PROVINCES: FilterOption[] = [
  { value: 'all', label: 'All Provinces' },
  { value: 'western', label: 'Western' },
  { value: 'central', label: 'Central' },
  { value: 'southern', label: 'Southern' },
];

export const DISTRICTS_BY_PROVINCE: { [key: string]: FilterOption[] } = {
  all: [{ value: 'all', label: 'All Districts' }],
  western: [
    { value: 'all', label: 'All Districts (Western)' },
    { value: 'colombo', label: 'Colombo' },
    { value: 'gampaha', label: 'Gampaha' },
    { value: 'kalutara', label: 'Kalutara' },
  ],
  central: [
    { value: 'all', label: 'All Districts (Central)' },
    { value: 'kandy', label: 'Kandy' },
    { value: 'matale', label: 'Matale' },
    { value: 'nuwaraeliya', label: 'Nuwara Eliya' },
  ],
  southern: [
    { value: 'all', label: 'All Districts (Southern)' },
    { value: 'galle', label: 'Galle' },
    { value: 'matara', label: 'Matara' },
    { value: 'hambantota', label: 'Hambantota' },
  ],
};

export const DS_DIVISIONS_BY_DISTRICT: { [key: string]: FilterOption[] } = {
    all: [{value: 'all', label: 'All DS Divisions'}],
    colombo: [
        { value: 'all', label: 'All DS Divisions (Colombo)' },
        { value: 'colombo_ds1', label: 'Colombo DS1'},
        { value: 'colombo_ds2', label: 'Colombo DS2'},
    ],
    kandy: [
        { value: 'all', label: 'All DS Divisions (Kandy)' },
        { value: 'kandy_ds1', label: 'Kandy DS1'},
        { value: 'kandy_ds2', label: 'Kandy DS2'},
    ]
    // Add more districts and their DS divisions as needed
};

export const RETAILERS_EXAMPLE: FilterOption[] = [ // This should align with retailer IDs from api.ts fetchRetailers
    { value: 'all', label: 'All Retailers'},
    { value: 'ret1', label: 'Alpha Super (Colombo)'},
    { value: 'ret2', label: 'Beta Foods (Gampaha)'},
    { value: 'ret3', label: 'Gamma Groceries (Kandy)'},
    { value: 'ret4', label: 'Delta Mart (Galle)'},
    { value: 'ret5', label: 'Epsilon Store (Colombo)'},
    { value: 'ret6', label: 'Zeta Wholesales (Matale)'},
    { value: 'ret7', label: 'Eta Retail (Matara)'},
    { value: 'ret8', label: 'Theta General (Kalutara)'},
    { value: 'ret9', label: 'Iota Supplies (Nuwara Eliya)'},
    { value: 'ret10', label: 'Kappa Corner (Hambantota)'},
];


// Flattened DISTRICTS for independent selection
export const ALL_DISTRICTS_OPTIONS: FilterOption[] = [{ value: 'all', label: 'All Districts' }];
PROVINCES.forEach(province => {
  if (province.value === 'all') return;
  (DISTRICTS_BY_PROVINCE[province.value] || []).forEach(district => {
    if (district.value === 'all') return; // Skip "All Districts (Province)" type entries from sub-lists
    // Assuming district.value is globally unique or unique enough for this flat list.
    if (!ALL_DISTRICTS_OPTIONS.find(opt => opt.value === district.value)) {
      ALL_DISTRICTS_OPTIONS.push({ value: district.value, label: `${district.label} (${province.label})` });
    }
  });
});
// Sort alphabetically by label, keeping 'All Districts' at the top
ALL_DISTRICTS_OPTIONS.sort((a, b) => {
    if (a.value === 'all') return -1;
    if (b.value === 'all') return 1;
    return a.label.localeCompare(b.label);
});


// Flattened DS DIVISIONS for independent selection
export const ALL_DS_DIVISIONS_OPTIONS: FilterOption[] = [{ value: 'all', label: 'All DS Divisions' }];
const allUniqueDistrictsForDsFlattening: FilterOption[] = [];
Object.values(DISTRICTS_BY_PROVINCE).flat().forEach(d => {
    if (d.value !== 'all' && !allUniqueDistrictsForDsFlattening.find(ud => ud.value === d.value)) {
        // Attempt to get the full district label with province if possible
        let districtFullLabel = d.label;
        const parentProvince = PROVINCES.find(p => (DISTRICTS_BY_PROVINCE[p.value] || []).some(dist => dist.value === d.value));
        if (parentProvince && parentProvince.value !== 'all') {
            districtFullLabel = `${d.label} (${parentProvince.label})`;
        }
        allUniqueDistrictsForDsFlattening.push({value: d.value, label: districtFullLabel});
    }
});

allUniqueDistrictsForDsFlattening.forEach(district => {
  (DS_DIVISIONS_BY_DISTRICT[district.value] || []).forEach(dsDivision => {
    if (dsDivision.value === 'all') return; // Skip "All DS Divisions (District)" type entries
    if (!ALL_DS_DIVISIONS_OPTIONS.find(opt => opt.value === dsDivision.value)) {
      // Use the district's simple label for brevity in DS Division's label
      const simpleDistrictLabel = district.label.split(' (')[0];
      ALL_DS_DIVISIONS_OPTIONS.push({ value: dsDivision.value, label: `${dsDivision.label} (${simpleDistrictLabel})` });
    }
  });
});
ALL_DS_DIVISIONS_OPTIONS.sort((a, b) => {
    if (a.value === 'all') return -1;
    if (b.value === 'all') return 1;
    return a.label.localeCompare(b.label);
});
