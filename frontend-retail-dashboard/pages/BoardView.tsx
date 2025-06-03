// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/pages/BoardView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'; // useMemo already here
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

const initialFilters: BoardFiltersState = {
  boardType: BOARD_TYPES[0]?.value || '',
  provider: 'all',
  salesRegion: 'all',
  salesDistrict: 'all',
  dsDivision: 'all',
  retailerId: 'all',
};

// Updated columns for the BoardView DataTable
const columnsForBoardView = [
  { Header: 'Entry ID', accessor: 'id' },
  { Header: 'Profile ID', accessor: 'PROFILE_ID' }, // Using raw PROFILE_ID from data
  { Header: 'Profile Name', accessor: 'PROFILE_NAME' },
  // { Header: 'Determined Board Type', accessor: 'boardType' }, // REMOVED as per request
  // { Header: 'Determined Provider', accessor: 'provider' },   // REMOVED as per request
  { Header: 'Province', accessor: 'PROVINCE' },
  { Header: 'District', accessor: 'DISTRICT' },
  { Header: 'DS Division', accessor: 'DS_DIVISION' },
  { Header: 'GN Division', accessor: 'GN_DIVISION' },
  { Header: 'Sales Region', accessor: 'SALES_REGION' },
  { Header: 'Sales District', accessor: 'SALES_DISTRICT' },
  { Header: 'Sales Area', accessor: 'SALES_AREA' }, // Ensure backend provides this
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
  const [boardData, setBoardData] = useState<BoardData[]>([]);
  const [retailerDataCount, setRetailerDataCount] = useState<number>(0);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedRetailerForOriginalImage, setSelectedRetailerForOriginalImage] = useState<Retailer | null>(null);
  const [detectedBoardImageIdentifier, setDetectedBoardImageIdentifier] = useState<string | undefined>(undefined);

  const [provinceOptions, setProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Loading...' }]);
  const [districtOptions, setDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Select Province' }]);
  const [dsDivisionOptions, setDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Select District' }]);
  const [retailerFilterOptions, setRetailerFilterOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Loading...' }]);

  const handleFilterChange = useCallback((filterName: keyof BoardFiltersState, value: string) => {
    setFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'salesRegion') {
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
  
  useEffect(() => {
    fetchProvinces().then(setProvinceOptions);
    const initialGeoFilters = { province: 'all', district: 'all', dsDivision: 'all' };
    fetchRetailers(initialGeoFilters).then(data => {
        const options = data.map(r => ({ value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})` }));
        setRetailerFilterOptions([{ value: 'all', label: 'All Retailers' }, ...options]);
    });
  }, []);

  useEffect(() => {
    const currentProvince = filters.salesRegion;
    if (currentProvince && currentProvince !== 'all') {
      setDistrictOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDistricts(currentProvince).then(setDistrictOptions);
    } else {
      setDistrictOptions([{ value: 'all', label: 'Select Province' }]);
    }
  }, [filters.salesRegion]);

  useEffect(() => {
    const currentDistrict = filters.salesDistrict;
    if (currentDistrict && currentDistrict !== 'all') {
      setDsDivisionOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDsDivisions(currentDistrict).then(setDsDivisionOptions);
    } else {
      setDsDivisionOptions([{ value: 'all', label: 'Select District' }]);
    }
  }, [filters.salesDistrict]);

   useEffect(() => {
    const geoFilters = {
        province: filters.salesRegion === 'all' ? undefined : filters.salesRegion,
        district: filters.salesDistrict === 'all' ? undefined : filters.salesDistrict,
        dsDivision: filters.dsDivision === 'all' ? undefined : filters.dsDivision,
    };
    // Only refetch if a geo filter has actually changed from its initial 'all' or previous value
    if (filters.salesRegion !== initialFilters.salesRegion || 
        filters.salesDistrict !== initialFilters.salesDistrict || 
        filters.dsDivision !== initialFilters.dsDivision) {
            setRetailerFilterOptions([{ value: 'all', label: 'Loading Retailers...' }]);
            fetchRetailers(geoFilters).then(data => {
                const options = data.map(r => ({ value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})` }));
                setRetailerFilterOptions([{value: 'all', label: 'All Retailers'}, ...options]);
            });
        }
  }, [filters.salesRegion, filters.salesDistrict, filters.dsDivision]);

  const applyFiltersAndFetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedRetailerForOriginalImage(null); 
    setDetectedBoardImageIdentifier(undefined);

    try {
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchBoards(filters);
      setBoardData(data); 
      setRetailerDataCount(count); 
      setProviderMetrics(fetchedProviderMetrics);

      const retailersForMapData = await fetchRetailers(filters); 
      setMapRetailers(retailersForMapData);

      if (filters.retailerId && filters.retailerId !== 'all') {
        const selectedRetailer = retailersForMapData.find(r => r.id === filters.retailerId);
        setSelectedRetailerForOriginalImage(selectedRetailer || null);

        const relevantBoard = data.find(
            b => b.retailerId === filters.retailerId &&
                 (filters.boardType === 'all' || b.boardType.toLowerCase() === filters.boardType.toLowerCase())
        );
        
        if (relevantBoard) {
            // Ensure `BoardData` type and backend response include `detectedBoardImageIdentifier`
            setDetectedBoardImageIdentifier(relevantBoard.detectedBoardImageIdentifier || relevantBoard.originalBoardImageIdentifier);
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
  }, []); 

  useEffect(() => {
    applyFiltersAndFetchData();
  }, [applyFiltersAndFetchData]);
  
  const handleDownloadCSV = () => {
    if (boardData.length === 0) {
        alert("No data to download.");
        return;
    }
    const csvString = convertToCSV(boardData, columnsForBoardView); // Use updated columns
    downloadCSV(csvString, 'board_data.csv');
  };

  useEffect(() => {
    const filterUI = (
      <FilterPanel title="Board Filters" onApplyFilters={applyFiltersAndFetchData} onResetFilters={resetFilters}>
        <RadioGroup
          label="Board Type"
          name="boardType"
          options={BOARD_TYPES}
          selectedValue={filters.boardType}
          onChange={(value) => handleFilterChange('boardType', value)}
        />
        <SelectDropdown
          label="Provider"
          options={PROVIDER_FILTER_OPTIONS}
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
    handleFilterChange, 
    setSidebarFilters,
    provinceOptions,
    districtOptions,
    dsDivisionOptions,
    retailerFilterOptions,
    // Removed applyFiltersAndFetchData & resetFilters from here as they are stable or called by buttons
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
                    altTextPrefix={selectedRetailerForOriginalImage?.name || "Board"}
                    defaultImageUrl="/assets/sample-retailer-placeholder.png"
                />
            ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {filters.retailerId === 'all' 
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