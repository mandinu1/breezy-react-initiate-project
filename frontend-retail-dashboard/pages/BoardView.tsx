// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-0fa4c536d6929256228f28fa08a2914fae3eabac/frontend-retail-dashboard/pages/BoardView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, BoardFiltersState, BoardData, ProviderMetric, Retailer, FilterOption } from '../types';
import FilterPanel from '../components/sidebar/FilterPanel';
import SelectDropdown from '../components/shared/SelectDropdown';
import RadioGroup from '../components/shared/RadioGroup';
import InteractiveMap from '../components/map/InteractiveMap';
import DataTable from '../components/data/DataTable';
import MetricBox from '../components/metrics/MetricBox';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorMessage from '../components/shared/ErrorMessage';
import DualImageDisplay from '../components/image/ImageDisplay'; // Corrected path if ImageDisplay is in '../components/image/ImageDisplay'
import Button from '../components/shared/Button';
import { UsersIcon, DownloadIcon } from '../components/shared/Icons';

import {
    fetchBoards,
    fetchRetailers,
    fetchProvinces,
    fetchDistricts,
    fetchDsDivisions
} from '../services/api';
import {
    BOARD_TYPES,
    PROVIDER_FILTER_OPTIONS,
    PROVIDERS_CONFIG,
} from '../constants';

interface BoardViewProps {
  viewMode: ViewMode;
  setSidebarFilters: (element: React.ReactNode | null) => void;
}

const initialBoardViewFilters: BoardFiltersState = {
  boardType: BOARD_TYPES[0]?.value || 'all', // Ensure 'all' is an option or handle default
  provider: 'all',
  salesRegion: 'all',
  salesDistrict: 'all',
  dsDivision: 'all',
  retailerId: 'all',
};


const columnsForBoardView = [
  { Header: 'Entry ID', accessor: 'id' },
  { Header: 'Profile ID', accessor: 'PROFILE_ID' },
  { Header: 'Profile Name', accessor: 'PROFILE_NAME' },
  { Header: 'Board Type', accessor: 'boardType' },
  { Header: 'Provider', accessor: 'provider' },
  { Header: 'Province', accessor: 'PROVINCE' },
  { Header: 'District', accessor: 'DISTRICT' },
  { Header: 'DS Division', accessor: 'DS_DIVISION' },
  { Header: 'GN Division', accessor: 'GN_DIVISION' },
  { Header: 'Sales Region', accessor: 'SALES_REGION' },
  { Header: 'Sales District', accessor: 'SALES_DISTRICT' },
  { Header: 'Sales Area', accessor: 'SALES_AREA' },
  // Provider specific counts - consider if these are always needed or if a generic "Count" based on "Provider" field is better
  { Header: 'Dialog Name Board', accessor: 'DIALOG_NAME_BOARD' },
  { Header: 'Mobitel Name Board', accessor: 'MOBITEL_NAME_BOARD' },
  { Header: 'Hutch Name Board', accessor: 'HUTCH_NAME_BOARD' },
  { Header: 'Airtel Name Board', accessor: 'AIRTEL_NAME_BOARD' },
  { Header: 'Dialog Side Board', accessor: 'DIALOG_SIDE_BOARD' },
  // Add other provider board counts if necessary
];

const convertToCSV = (data: any[], columns: { Header: string, accessor: string }[]): string => {
    const header = columns.map(col => `"${col.Header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            let cellData = row[col.accessor];
            if (typeof cellData === 'object' && cellData !== null) cellData = JSON.stringify(cellData);
            if (cellData === undefined || cellData === null) cellData = '';
            else cellData = String(cellData);
            return `"${cellData.replace(/"/g, '""')}"`;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

const BoardView: React.FC<BoardViewProps> = ({ viewMode, setSidebarFilters }) => {
  const [currentFilters, setCurrentFilters] = useState<BoardFiltersState>(initialBoardViewFilters);
  const [boardData, setBoardData] = useState<BoardData[]>([]);
  const [boardDataCount, setBoardDataCount] = useState<number>(0); // Renamed from retailerDataCount for clarity
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState<Record<string, boolean>>({}); // For individual dropdown loading
  const [error, setError] = useState<string | null>(null);

  const [selectedRetailerForOriginalImage, setSelectedRetailerForOriginalImage] = useState<Retailer | null>(null);
  const [detectedBoardImageIdentifier, setDetectedBoardImageIdentifier] = useState<string | undefined>(undefined);

  const [provinceOptions, setProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Provinces/Regions' }]);
  const [districtOptions, setDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [dsDivisionOptions, setDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [retailerFilterOptions, setRetailerFilterOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);

  const isSalesView = viewMode === 'sales';
  const geoLabel = isSalesView ? 'Sales' : 'Admin';


  const handleFilterChange = useCallback((filterName: keyof BoardFiltersState, value: string) => {
    setCurrentFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };

        // Smartly reset dependent filters IF a higher-level geo filter changes to a *specific* value,
        // or if provider changes. If a geo filter changes TO 'all', don't reset children yet, let them refetch.
        if (filterName === 'provider') {
            newFilters.salesRegion = 'all';
            newFilters.salesDistrict = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'salesRegion' && value !== 'all') {
            newFilters.salesDistrict = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'salesDistrict' && value !== 'all') {
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'dsDivision' && value !== 'all') {
            newFilters.retailerId = 'all';
        }
        // If a filter is set back to 'all', its children will re-fetch broader options.
        return newFilters;
    });
  }, []);


  // Fetch Provinces
  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, provinces: true}));
    fetchProvinces(currentFilters.provider, isSalesView).then(options => {
        setProvinceOptions([{ value: 'all', label: isSalesView ? 'All Sales Regions' : 'All Provinces' }, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, provinces: false})));
  }, [currentFilters.provider, isSalesView]);

  // Fetch Districts
  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, districts: true}));
    fetchDistricts(currentFilters.provider, currentFilters.salesRegion, isSalesView).then(options => {
        setDistrictOptions([{ value: 'all', label: isSalesView ? 'All Sales Districts' : 'All Districts' }, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, districts: false})));
  }, [currentFilters.provider, currentFilters.salesRegion, isSalesView]);

  // Fetch DS Divisions
  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, dsDivisions: true}));
    fetchDsDivisions(currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict).then(options => {
        setDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, dsDivisions: false})));
  }, [currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict]);

  // Fetch Retailers
  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, retailers: true}));
    const filtersForRetailerFetch: any = {
        provider: currentFilters.provider,
        // Pass the correct geo field based on viewMode if backend distinguishes
        // Assuming backend /retailers handles salesRegion/province and salesDistrict/district query params
    };
    if (isSalesView) {
        filtersForRetailerFetch.salesRegion = currentFilters.salesRegion;
        filtersForRetailerFetch.salesDistrict = currentFilters.salesDistrict;
    } else {
        filtersForRetailerFetch.province = currentFilters.salesRegion; // Assuming salesRegion maps to province in admin
        filtersForRetailerFetch.district = currentFilters.salesDistrict; // Assuming salesDistrict maps to district in admin
    }
    filtersForRetailerFetch.dsDivision = currentFilters.dsDivision;

    fetchRetailers(filtersForRetailerFetch).then(data => {
        const options = data.map(r => ({
            value: r.id,
            label: `${r.id} - ${r.name}`
        }));
        setRetailerFilterOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, retailers: false})));
  }, [currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict, currentFilters.dsDivision, isSalesView]);

  const fetchDataWithCurrentFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedRetailerForOriginalImage(null);
    setDetectedBoardImageIdentifier(undefined);

    const apiFilters: Partial<BoardFiltersState> = { ...currentFilters };
    // The backend will interpret 'all' as no filter for that field.

    try {
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchBoards(apiFilters);
      setBoardData(data);
      setBoardDataCount(count);
      setProviderMetrics(fetchedProviderMetrics);

      // Fetch retailers for the map using the same active filters
      const retailerApiFilters: any = {
          provider: apiFilters.provider,
          dsDivision: apiFilters.dsDivision,
      };
      if (isSalesView) {
          retailerApiFilters.salesRegion = apiFilters.salesRegion;
          retailerApiFilters.salesDistrict = apiFilters.salesDistrict;
      } else {
          retailerApiFilters.province = apiFilters.salesRegion;
          retailerApiFilters.district = apiFilters.salesDistrict;
      }
      if (apiFilters.retailerId && apiFilters.retailerId !== 'all') {
        // If a specific retailer is selected, map should ideally focus on/only show that one.
        // For now, fetchRetailers might return a list, and we can find the selected one.
         retailerApiFilters.retailerId = apiFilters.retailerId;
      }


      const retailersForMapData = await fetchRetailers(retailerApiFilters);
      setMapRetailers(retailersForMapData);

      if (currentFilters.retailerId && currentFilters.retailerId !== 'all') {
        const selectedRetailer = retailersForMapData.find(r => r.id === currentFilters.retailerId);
        setSelectedRetailerForOriginalImage(selectedRetailer || null);

        // Find a relevant board from the already filtered boardData for image display
        const relevantBoard = data.find(
            b => b.retailerId === currentFilters.retailerId &&
                 (currentFilters.boardType === 'all' || !currentFilters.boardType || b.boardType?.toLowerCase() === currentFilters.boardType.toLowerCase()) &&
                 (currentFilters.provider === 'all' || !currentFilters.provider || b.provider?.toLowerCase() === currentFilters.provider.toLowerCase())
        );
        if (relevantBoard) {
            setDetectedBoardImageIdentifier(relevantBoard.detectedBoardImageIdentifier || relevantBoard.originalBoardImageIdentifier);
        } else if (data.length > 0 && currentFilters.retailerId !== 'all' && data[0].retailerId === currentFilters.retailerId) {
            // Fallback if specific boardType/provider on the selected retailer is not found, but retailer data exists
            setDetectedBoardImageIdentifier(data[0].detectedBoardImageIdentifier || data[0].originalBoardImageIdentifier);
        }
      }
    } catch (err) {
      console.error("Failed to fetch board data:", err);
      setError("Failed to load board data. Please try again.");
      setBoardData([]);
      setBoardDataCount(0);
      setProviderMetrics([]);
      setMapRetailers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters, isSalesView]);

  const resetAllFilters = useCallback(() => {
    setCurrentFilters(initialBoardViewFilters);
    // Data will clear or refetch with initial filters upon next "Apply Filters"
    // Or, if you want an immediate clear/refetch:
    setBoardData([]);
    setBoardDataCount(0);
    setMapRetailers([]);
    setProviderMetrics([]);
    setSelectedRetailerForOriginalImage(null);
    setDetectedBoardImageIdentifier(undefined);
    // Optionally, trigger a fetch for all data immediately:
    // fetchDataWithCurrentFilters(); // This line is commented to adhere to Apply button paradigm
  }, []);

  // Effect to set up the sidebar filter panel
  useEffect(() => {
    const filterUI = (
      <FilterPanel title="Board Filters" onApplyFilters={fetchDataWithCurrentFilters} onResetFilters={resetAllFilters}>
        <SelectDropdown
          label="Provider"
          options={PROVIDER_FILTER_OPTIONS}
          value={currentFilters.provider}
          onChange={(e) => handleFilterChange('provider', e.target.value)}
          disabled={isLoadingOptions['provinces']} // Disable if dependent options are loading
        />
        <RadioGroup
          label="Board Type"
          name="boardType"
          options={[{value: 'all', label: 'All Types'}, ...BOARD_TYPES]}
          selectedValue={currentFilters.boardType || 'all'}
          onChange={(value) => handleFilterChange('boardType', value)}
        />
        <SelectDropdown
          label={isSalesView ? "Sales Region" : "Province"}
          options={provinceOptions}
          value={currentFilters.salesRegion}
          onChange={(e) => handleFilterChange('salesRegion', e.target.value)}
          disabled={isLoadingOptions['provinces'] || isLoadingOptions['districts']}
        />
        <SelectDropdown
          label={isSalesView ? "Sales District" : "District"}
          options={districtOptions}
          value={currentFilters.salesDistrict}
          onChange={(e) => handleFilterChange('salesDistrict', e.target.value)}
          disabled={isLoadingOptions['districts'] || isLoadingOptions['dsDivisions']}
        />
         <SelectDropdown
          label="DS Division"
          options={dsDivisionOptions}
          value={currentFilters.dsDivision}
          onChange={(e) => handleFilterChange('dsDivision', e.target.value)}
          disabled={isLoadingOptions['dsDivisions'] || isLoadingOptions['retailers']}
        />
        <SelectDropdown
          label="Retailer Name/ID"
          options={retailerFilterOptions}
          value={currentFilters.retailerId}
          onChange={(e) => handleFilterChange('retailerId', e.target.value)}
          disabled={isLoadingOptions['retailers']}
        />
      </FilterPanel>
    );
    setSidebarFilters(filterUI);

    // Initial data load when component mounts and filters are set up
    // This ensures data is loaded when the view is first accessed.
    if(boardData.length === 0 && mapRetailers.length === 0 && !isLoading){ // Fetch only if no data and not already loading
        // fetchDataWithCurrentFilters(); // Let Apply button control this for now based on user flow.
    }


    return () => {
      setSidebarFilters(null);
    };
  }, [
    currentFilters,
    viewMode, isSalesView,
    handleFilterChange,
    fetchDataWithCurrentFilters, resetAllFilters,
    setSidebarFilters,
    provinceOptions, districtOptions, dsDivisionOptions, retailerFilterOptions,
    isLoadingOptions, boardData, mapRetailers, isLoading // Added to dep array
  ]);
  
  // Fetch initial data when the component mounts or viewMode changes.
  // This ensures that if the user switches view modes and comes back, data reflecting current filters is loaded.
  // However, the user wants to click "Apply" to load. So, this initial fetch might be redundant
  // if the expectation is strictly button-driven after initial page setup.
  // For now, let's rely on the FilterPanel's onApplyFilters for explicit data loading.
  // The sidebar useEffect will set up the panel, and then user interaction drives data.

  const handleDownloadCSV = () => {
    if (boardData.length === 0) {
        alert("No data to download.");
        return;
    }
    const csvString = convertToCSV(boardData, columnsForBoardView);
    downloadCSV(csvString, 'board_data.csv');
  };


  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Board View ({viewMode === 'sales' ? 'Sales' : 'Admin'})</h2>

      {isLoading && <LoadingSpinner message="Loading board data..." />}
      {error && <ErrorMessage message={error} />}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <MetricBox
                title={`Retailer Count on Map`}
                value={mapRetailers.length.toString()}
                icon={<UsersIcon />}
            />
             <MetricBox
                title={`Board Entries in Table`}
                value={boardDataCount.toString()}
                icon={<UsersIcon />} // Placeholder, consider a table icon
            />
          </div>

          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Locations</h3>
            <InteractiveMap retailers={mapRetailers} geoJsonData={null} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {providerMetrics.map(metric => {
                 const providerConfig = PROVIDERS_CONFIG.find(p => p.name === metric.provider);
                 return (
                    <MetricBox
                        key={metric.provider}
                        title={`${metric.provider} Boards`}
                        value={metric.count?.toString() || '0'}
                        accentColor={providerConfig?.color}
                        providerLogoUrl={providerConfig?.logoUrl}
                    />
                 );
            })}
          </div>

          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Retailer & Board Images</h3>
            </div>
            {currentFilters.retailerId !== 'all' && (selectedRetailerForOriginalImage || detectedBoardImageIdentifier) ? (
                <DualImageDisplay
                    originalImageIdentifier={selectedRetailerForOriginalImage?.imageIdentifier}
                    detectedImageIdentifier={detectedBoardImageIdentifier}
                    altTextPrefix={selectedRetailerForOriginalImage?.name || currentFilters.retailerId || "Board"}
                    defaultImageUrl="/assets/sample-retailer-placeholder.png"
                />
            ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {currentFilters.retailerId === 'all'
                        ? "Select a specific retailer to view images."
                        : (isLoadingOptions['retailers'] || isLoading) ? "Loading images..." : "Image(s) not available for the selected retailer or board configuration."
                    }
                </p>
            )}
          </div>

          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Board Data Details ({boardDataCount} items)</h3>
              <Button
                onClick={handleDownloadCSV}
                variant="outline"
                size="sm"
                disabled={boardData.length === 0}
                aria-label="Download board data as CSV"
              >
                <DownloadIcon className="w-4 h-4 mr-2"/>
                Download CSV
              </Button>
            </div>
            <DataTable
              columns={columnsForBoardView}
              data={boardData}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default BoardView;