// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/pages/BoardView.tsx
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
// Import the DualImageDisplay (assuming ImageDisplay.tsx was updated as previously discussed)
import DualImageDisplay from '../components/image/ImageDisplay'; 
// import ImageModal from '../components/shared/ImageModal'; // Modal logic will be simplified/removed for now
import Button from '../components/shared/Button';
import { UsersIcon, /* EyeIcon, */ DownloadIcon } from '../components/shared/Icons'; // EyeIcon might be removed if modal changes

import { 
    fetchBoards, 
    fetchRetailers,
    fetchProvinces,
    fetchDistricts,
    fetchDsDivisions // Assuming you create this in services/api.ts and its backend endpoint
} from '../services/api';
import { 
    BOARD_TYPES, 
    PROVIDER_FILTER_OPTIONS, // These can remain if they are truly static
    PROVIDERS_CONFIG,
} from '../constants'; // Only truly static constants should remain here long-term

interface BoardViewProps {
  viewMode: ViewMode;
  setSidebarFilters: (element: React.ReactNode | null) => void;
}

const initialFilters: BoardFiltersState = {
  boardType: BOARD_TYPES[0]?.value || '', // Default to first board type
  provider: 'all',
  salesRegion: 'all', // Will correspond to province value
  salesDistrict: 'all',
  dsDivision: 'all',
  retailerId: 'all',
};

const columnsForDataTable = [
    { Header: 'ID', accessor: 'id' },
    { Header: 'Retailer ID', accessor: 'retailerId' },
    { Header: 'Board Type', accessor: 'boardType' }, // This should be populated by backend
    { Header: 'Provider', accessor: 'provider' },   // This should be populated by backend
];

const convertToCSV = (data: any[], columns: { Header: string, accessor: string }[]): string => {
    const header = columns.map(col => `"${col.Header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            let cellData = row[col.accessor];
            if (cellData === undefined || cellData === null) {
                cellData = '';
            } else {
                cellData = String(cellData);
            }
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
  const [filters, setFilters] = useState<BoardFiltersState>(initialFilters);
  const [boardData, setBoardData] = useState<BoardData[]>([]); // Expect BoardData to potentially include image ARNs
  const [retailerDataCount, setRetailerDataCount] = useState<number>(0);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // For DualImageDisplay
  const [selectedRetailerForOriginalImage, setSelectedRetailerForOriginalImage] = useState<Retailer | null>(null);
  const [detectedBoardImageIdentifier, setDetectedBoardImageIdentifier] = useState<string | undefined>(undefined);

  // Dynamic filter options states
  const [provinceOptions, setProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Loading...' }]);
  const [districtOptions, setDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Select Province' }]);
  const [dsDivisionOptions, setDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Select District' }]);
  const [retailerFilterOptions, setRetailerFilterOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Loading...' }]);

  const handleFilterChange = useCallback((filterName: keyof BoardFiltersState, value: string) => {
    setFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        // Reset dependent filters if a parent filter changes to 'all' or changes value
        if (filterName === 'salesRegion') {
            newFilters.salesDistrict = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all'; // Optional: Reset retailer if region changes
        } else if (filterName === 'salesDistrict') {
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all'; // Optional: Reset retailer if district changes
        } else if (filterName === 'dsDivision') {
             newFilters.retailerId = 'all'; // Optional
        }
        return newFilters;
    });
  }, []); 
  
  // Fetch initial dynamic filter options
  useEffect(() => {
    fetchProvinces().then(setProvinceOptions);
    // Fetch initial retailers (all, or based on default 'all' filters)
    fetchRetailers({ province: 'all', district: 'all', dsDivision: 'all' }).then(data => {
        const options = data.map(r => ({ value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})` }));
        setRetailerFilterOptions([{ value: 'all', label: 'All Retailers' }, ...options]);
    });
  }, []);

  // Fetch districts when province (salesRegion) filter changes
  useEffect(() => {
    const currentProvince = filters.salesRegion;
    if (currentProvince && currentProvince !== 'all') {
      setDistrictOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDistricts(currentProvince).then(setDistrictOptions);
    } else {
      setDistrictOptions([{ value: 'all', label: 'Select Province' }]);
    }
  }, [filters.salesRegion]);

  // Fetch DS divisions when district (salesDistrict) filter changes
  useEffect(() => {
    const currentDistrict = filters.salesDistrict;
    if (currentDistrict && currentDistrict !== 'all') {
      setDsDivisionOptions([{ value: 'all', label: 'Loading...' }]);
      // Assuming you create fetchDsDivisions in services/api.ts and a backend endpoint
      fetchDsDivisions(currentDistrict).then(setDsDivisionOptions);
    } else {
      setDsDivisionOptions([{ value: 'all', label: 'Select District' }]);
    }
  }, [filters.salesDistrict]);

  // Re-fetch retailer options if major geo filters change
   useEffect(() => {
    setRetailerFilterOptions([{ value: 'all', label: 'Loading Retailers...' }]);
    const geoFilters = {
        province: filters.salesRegion === 'all' ? undefined : filters.salesRegion,
        district: filters.salesDistrict === 'all' ? undefined : filters.salesDistrict,
        dsDivision: filters.dsDivision === 'all' ? undefined : filters.dsDivision,
    };
    fetchRetailers(geoFilters).then(data => {
        const options = data.map(r => ({ value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})` }));
        setRetailerFilterOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    });
  }, [filters.salesRegion, filters.salesDistrict, filters.dsDivision]);


  const applyFiltersAndFetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedRetailerForOriginalImage(null);
    setDetectedBoardImageIdentifier(undefined);

    try {
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchBoards(filters);
      setBoardData(data); // Expect 'data' items to be BoardData, potentially with image ARNs
      setRetailerDataCount(count); 
      setProviderMetrics(fetchedProviderMetrics);

      // Fetch retailers for the map based on the same main filters
      const retailersForMapData = await fetchRetailers(filters); 
      setMapRetailers(retailersForMapData);

      if (filters.retailerId && filters.retailerId !== 'all') {
        const selectedRetailer = retailersForMapData.find(r => r.id === filters.retailerId);
        setSelectedRetailerForOriginalImage(selectedRetailer || null);

        // Logic to find the detected board image identifier
        // This assumes your `BoardData` objects in `data` might have a field like `detectedBoardImageIdentifier`
        // or `inferenceImageArn` added by the backend.
        const relevantBoard = data.find(
            b => b.retailerId === filters.retailerId &&
                 (filters.boardType === 'all' || b.boardType.toLowerCase() === filters.boardType.toLowerCase())
        );
        
        if (relevantBoard) {
            // @ts-ignore --- This line assumes 'detectedBoardImageIdentifier' will be added to BoardData type
            const detectedId = relevantBoard.detectedBoardImageIdentifier || relevantBoard.specificBoardInferenceArn; 
            // TODO: Update BoardData type in types.ts and ensure backend populates this.
            // Example: If BoardData has fields like nameBoardInfS3Arn, tinBoardInfS3Arn etc.
            // you would pick one based on filters.boardType
            // For now, if 'detectedId' is undefined, DualImageDisplay will use placeholder.
            setDetectedBoardImageIdentifier(detectedId);
        }

      }
    } catch (err) {
      console.error("Failed to fetch board data:", err);
      setError("Failed to load board data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]); 

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSelectedRetailerForOriginalImage(null);
    setDetectedBoardImageIdentifier(undefined);
    // Data will re-fetch due to useEffect on filters change via applyFiltersAndFetchData
  }, []); 

  useEffect(() => {
    applyFiltersAndFetchData();
  }, [applyFiltersAndFetchData]);
  
  const handleDownloadCSV = () => {
    if (boardData.length === 0) {
        alert("No data to download.");
        return;
    }
    const csvString = convertToCSV(boardData, columnsForDataTable);
    downloadCSV(csvString, 'board_data.csv');
  };

  useEffect(() => {
    const filterUI = (
      <FilterPanel title="Board Filters" onApplyFilters={applyFiltersAndFetchData} onResetFilters={resetFilters}>
        <RadioGroup
          label="Board Type"
          name="boardType"
          options={BOARD_TYPES} // Static for now
          selectedValue={filters.boardType}
          onChange={(value) => handleFilterChange('boardType', value)}
        />
        <SelectDropdown
          label="Provider"
          options={PROVIDER_FILTER_OPTIONS} // Static for now
          value={filters.provider}
          onChange={(e) => handleFilterChange('provider', e.target.value)}
        />
        <SelectDropdown
          label={viewMode === 'sales' ? "Sales Region" : "Province"}
          options={provinceOptions}
          value={filters.salesRegion}
          onChange={(e) => handleFilterChange('salesRegion', e.target.value)}
        />
        <SelectDropdown
          label={viewMode === 'sales' ? "Sales District" : "District"}
          options={districtOptions}
          value={filters.salesDistrict}
          onChange={(e) => handleFilterChange('salesDistrict', e.target.value)}
          disabled={filters.salesRegion === 'all' && provinceOptions.length > 1 && provinceOptions[0].value !== 'all'}
        />
         <SelectDropdown
          label="DS Division"
          options={dsDivisionOptions}
          value={filters.dsDivision}
          onChange={(e) => handleFilterChange('dsDivision', e.target.value)}
          disabled={filters.salesDistrict === 'all' && districtOptions.length > 1 && districtOptions[0].value !== 'all'}
        />
        <SelectDropdown
          label="Retailer Name/ID"
          options={retailerFilterOptions} 
          value={filters.retailerId}
          onChange={(e) => handleFilterChange('retailerId', e.target.value)}
        />
      </FilterPanel>
    );
    setSidebarFilters(filterUI);

    return () => {
      setSidebarFilters(null); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters, 
    viewMode, 
    applyFiltersAndFetchData, 
    resetFilters, 
    handleFilterChange, 
    setSidebarFilters,
    provinceOptions,
    districtOptions,
    dsDivisionOptions,
    retailerFilterOptions
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Board View ({viewMode === 'sales' ? 'Sales' : 'Admin'})</h2>
      
      {isLoading && <LoadingSpinner message="Loading board data..." />}
      {error && <ErrorMessage message={error} />}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <MetricBox 
                title="Retailer Count (Map)" 
                value={mapRetailers.length.toString()}
                icon={<UsersIcon />} 
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
            {filters.retailerId !== 'all' && (selectedRetailerForOriginalImage || detectedBoardImageIdentifier) ? (
                <DualImageDisplay
                    originalImageIdentifier={selectedRetailerForOriginalImage?.imageIdentifier}
                    detectedImageIdentifier={detectedBoardImageIdentifier}
                    altTextPrefix={selectedRetailerForOriginalImage?.name || "Selected item"}
                    defaultImageUrl="/assets/sample-retailer-placeholder.png" // Ensure this exists in public/assets
                />
            ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {filters.retailerId !== 'all' 
                        ? "Image(s) not available for the selected retailer or board type."
                        : "Select a specific retailer to view images."}
                </p>
            )}
          </div>

          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Board Data Details ({retailerDataCount} items)</h3>
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
              columns={columnsForDataTable}
              data={boardData}
            />
          </div>
        </>
      )}
      {/* ImageModal logic might need to be adapted if you want to click on individual images 
        within DualImageDisplay to show them larger. For now, it's removed to simplify.
      */}
    </div>
  );
};

export default BoardView;