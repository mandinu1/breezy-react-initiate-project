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
import DualImageDisplay from '../components/image/ImageDisplay';
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
  boardType: BOARD_TYPES[0]?.value || '',
  provider: 'all',
  salesRegion: 'all', // For Sales view, maps to Province
  salesDistrict: 'all', // For Sales view, maps to District
  dsDivision: 'all', // Common for both
  retailerId: 'all',
  // Add province and district for admin view if they are separate fields in state
  // For simplicity, we'll use salesRegion/salesDistrict and map labels/API params
};


const columnsForBoardView = [
  { Header: 'Entry ID', accessor: 'id' },
  { Header: 'Profile ID', accessor: 'PROFILE_ID' },
  { Header: 'Profile Name', accessor: 'PROFILE_NAME' },
  { Header: 'Province', accessor: 'PROVINCE' },
  { Header: 'District', accessor: 'DISTRICT' },
  { Header: 'DS Division', accessor: 'DS_DIVISION' },
  { Header: 'GN Division', accessor: 'GN_DIVISION' },
  { Header: 'Sales Region', accessor: 'SALES_REGION' },
  { Header: 'Sales District', accessor: 'SALES_DISTRICT' },
  { Header: 'Sales Area', accessor: 'SALES_AREA' },
  { Header: 'Dialog Name Board', accessor: 'DIALOG_NAME_BOARD' },
  { Header: 'Mobitel Name Board', accessor: 'MOBITEL_NAME_BOARD' },
  { Header: 'Hutch Name Board', accessor: 'HUTCH_NAME_BOARD' },
  { Header: 'Airtel Name Board', accessor: 'AIRTEL_NAME_BOARD' },
  { Header: 'Dialog Side Board', accessor: 'DIALOG_SIDE_BOARD' },
  { Header: 'Mobitel Side Board', accessor: 'MOBITEL_SIDE_BOARD' },
  { Header: 'Hutch Side Board', accessor: 'HUTCH_SIDE_BOARD' },
  { Header: 'Airtel Side Board', accessor: 'AIRTEL_SIDE_BOARD' },
  { Header: 'Dialog Tin Board', accessor: 'DIALOG_TIN_BOARD' },
  { Header: 'Mobitel Tin Board', accessor: 'MOBITEL_TIN_BOARD' },
  { Header: 'Hutch Tin Board', accessor: 'HUTCH_TIN_BOARD' },
  { Header: 'Airtel Tin Board', accessor: 'AIRTEL_TIN_BOARD' },
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
  const [retailerDataCount, setRetailerDataCount] = useState<number>(0);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedRetailerForOriginalImage, setSelectedRetailerForOriginalImage] = useState<Retailer | null>(null);
  const [detectedBoardImageIdentifier, setDetectedBoardImageIdentifier] = useState<string | undefined>(undefined);

  // Dynamic filter options states
  const [provinceOptions, setProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Provinces' }]);
  const [districtOptions, setDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [dsDivisionOptions, setDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [retailerFilterOptions, setRetailerFilterOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);

  const isSalesView = viewMode === 'sales';

  // Handles changes to any filter dropdown
  const handleFilterChange = useCallback((filterName: keyof BoardFiltersState, value: string) => {
    setCurrentFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        // Cascading reset
        if (filterName === 'provider') {
            newFilters.salesRegion = 'all';
            newFilters.salesDistrict = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'salesRegion') {
            newFilters.salesDistrict = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'salesDistrict') {
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'dsDivision') {
            newFilters.retailerId = 'all';
        }
        return newFilters;
    });
  }, []); 

  // Fetch Provinces based on Provider
  useEffect(() => {
    const provider = currentFilters.provider;
    // Pass viewMode to backend if backend needs to distinguish between PROVINCE and SALES_REGION column
    fetchProvinces(provider, isSalesView).then(options => {
        setProvinceOptions([{ value: 'all', label: isSalesView ? 'All Sales Regions' : 'All Provinces' }, ...options]);
    });
  }, [currentFilters.provider, isSalesView]);

  // Fetch Districts based on Provider and Province/SalesRegion
  useEffect(() => {
    const provider = currentFilters.provider;
    const region = currentFilters.salesRegion; // This field is used for both Province and Sales Region
    if (region && region !== 'all') {
      setDistrictOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDistricts(provider, region, isSalesView).then(options => {
          setDistrictOptions([{ value: 'all', label: isSalesView ? 'All Sales Districts' : 'All Districts' }, ...options]);
      });
    } else {
      setDistrictOptions([{ value: 'all', label: isSalesView ? 'All Sales Districts' : 'All Districts' }]);
    }
  }, [currentFilters.provider, currentFilters.salesRegion, isSalesView]);

  // Fetch DS Divisions based on Provider, Province/SalesRegion, and District/SalesDistrict
  useEffect(() => {
    const provider = currentFilters.provider;
    const region = currentFilters.salesRegion;
    const district = currentFilters.salesDistrict;
    if (district && district !== 'all') {
      setDsDivisionOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDsDivisions(provider, region, district).then(options => { // Assuming fetchDsDivisions takes all 3
          setDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }, ...options]);
      });
    } else {
      setDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }]);
    }
  }, [currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict]);
  
  // Fetch Retailers based on all preceding filters
  useEffect(() => {
    const { provider, salesRegion, salesDistrict, dsDivision } = currentFilters;
    const geoFiltersForRetailers: any = {};
    if (provider !== 'all') geoFiltersForRetailers.provider = provider;
    if (salesRegion !== 'all') geoFiltersForRetailers[isSalesView ? 'salesRegion' : 'province'] = salesRegion;
    if (salesDistrict !== 'all') geoFiltersForRetailers[isSalesView ? 'salesDistrict' : 'district'] = salesDistrict;
    if (dsDivision !== 'all') geoFiltersForRetailers.dsDivision = dsDivision;
    
    setRetailerFilterOptions([{ value: 'all', label: 'Loading Retailers...' }]);
    fetchRetailers(geoFiltersForRetailers).then(data => {
        const options = data.map(r => ({ 
            value: r.id, 
            label: `${r.id} - ${r.name}` // Format: ID - Name
        }));
        setRetailerFilterOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    });
  }, [currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict, currentFilters.dsDivision, isSalesView]);

  // This function is called when "Apply Filters" button is clicked
  const fetchDataWithCurrentFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedRetailerForOriginalImage(null); 
    setDetectedBoardImageIdentifier(undefined);

    // Prepare filters to send to backend, mapping salesRegion/District if necessary
    const apiFilters: Partial<BoardFiltersState> = { ...currentFilters };
    if (isSalesView) {
        // Backend should ideally handle 'salesRegion' and 'salesDistrict' directly if they map to different columns
        // Or, ensure the 'province' and 'district' fields in BoardFiltersState are always used by backend
        // and frontend maps to them. For now, currentFilters already uses salesRegion/salesDistrict.
    }


    try {
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchBoards(apiFilters);
      setBoardData(data); 
      setRetailerDataCount(count); 
      setProviderMetrics(fetchedProviderMetrics);

      const retailersForMapData = await fetchRetailers(apiFilters); 
      setMapRetailers(retailersForMapData);

      if (currentFilters.retailerId && currentFilters.retailerId !== 'all') {
        const selectedRetailer = retailersForMapData.find(r => r.id === currentFilters.retailerId);
        setSelectedRetailerForOriginalImage(selectedRetailer || null);
        
        const relevantBoard = data.find(
            b => b.retailerId === currentFilters.retailerId &&
                 (currentFilters.boardType === 'all' || b.boardType.toLowerCase() === currentFilters.boardType.toLowerCase())
        );
        if (relevantBoard) {
            setDetectedBoardImageIdentifier(relevantBoard.detectedBoardImageIdentifier || relevantBoard.originalBoardImageIdentifier);
        }
      }
    } catch (err) {
      console.error("Failed to fetch board data:", err);
      setError("Failed to load board data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters, isSalesView]); 

  const resetAllFilters = useCallback(() => {
    setCurrentFilters(initialBoardViewFilters);
    // Data will re-fetch when "Apply Filters" is clicked next, or if you want an immediate fetch:
    // fetchDataWithCurrentFilters(); // This would fetch with initial filters
  }, []); 

  // No automatic fetch on filter change anymore. Fetching is done by "Apply Filters" button.
  
  const handleDownloadCSV = () => {
    if (boardData.length === 0) {
        alert("No data to download.");
        return;
    }
    const csvString = convertToCSV(boardData, columnsForBoardView);
    downloadCSV(csvString, 'board_data.csv');
  };

  useEffect(() => {
    const filterUI = (
      <FilterPanel title="Board Filters" onApplyFilters={fetchDataWithCurrentFilters} onResetFilters={resetAllFilters}>
        <SelectDropdown
          label="Provider"
          options={PROVIDER_FILTER_OPTIONS} // Static for now
          value={currentFilters.provider}
          onChange={(e) => handleFilterChange('provider', e.target.value)}
        />
        <RadioGroup // Assuming Board Type is still a RadioGroup and static
          label="Board Type"
          name="boardType"
          options={BOARD_TYPES}
          selectedValue={currentFilters.boardType}
          onChange={(value) => handleFilterChange('boardType', value)}
        />
        <SelectDropdown
          label={isSalesView ? "Sales Region" : "Province"}
          options={provinceOptions}
          value={currentFilters.salesRegion}
          onChange={(e) => handleFilterChange('salesRegion', e.target.value)}
          disabled={currentFilters.provider === 'all' && provinceOptions.length > 1 && provinceOptions[0].value !== 'all'}
        />
        <SelectDropdown
          label={isSalesView ? "Sales District" : "District"}
          options={districtOptions}
          value={currentFilters.salesDistrict}
          onChange={(e) => handleFilterChange('salesDistrict', e.target.value)}
          disabled={currentFilters.salesRegion === 'all' && districtOptions.length > 1 && districtOptions[0].value !== 'all'}
        />
         <SelectDropdown
          label="DS Division"
          options={dsDivisionOptions}
          value={currentFilters.dsDivision}
          onChange={(e) => handleFilterChange('dsDivision', e.target.value)}
          disabled={currentFilters.salesDistrict === 'all' && dsDivisionOptions.length > 1 && dsDivisionOptions[0].value !== 'all'}
        />
        <SelectDropdown
          label="Retailer Name/ID"
          options={retailerFilterOptions} 
          value={currentFilters.retailerId}
          onChange={(e) => handleFilterChange('retailerId', e.target.value)}
          disabled={currentFilters.dsDivision === 'all' && dsDivisionOptions.length > 1 && dsDivisionOptions[0].value !== 'all' && currentFilters.salesDistrict === 'all' && currentFilters.salesRegion === 'all' && currentFilters.provider === 'all'}
        />
      </FilterPanel>
    );
    setSidebarFilters(filterUI);

    return () => {
      setSidebarFilters(null); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentFilters, 
    viewMode, isSalesView,
    handleFilterChange, 
    fetchDataWithCurrentFilters, resetAllFilters, // These are now passed to FilterPanel
    setSidebarFilters,
    provinceOptions, districtOptions, dsDivisionOptions, retailerFilterOptions
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
            {currentFilters.retailerId !== 'all' && (selectedRetailerForOriginalImage || detectedBoardImageIdentifier) ? (
                <DualImageDisplay
                    originalImageIdentifier={selectedRetailerForOriginalImage?.imageIdentifier}
                    detectedImageIdentifier={detectedBoardImageIdentifier}
                    altTextPrefix={selectedRetailerForOriginalImage?.name || "Board"}
                    defaultImageUrl="/assets/sample-retailer-placeholder.png"
                />
            ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {currentFilters.retailerId === 'all' 
                        ? "Select a specific retailer to view images."
                        : "Image(s) not available for the selected retailer or board configuration."
                    }
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