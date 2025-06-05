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
import DualImageDisplay from '../components/image/ImageDisplay';
import Button from '../components/shared/Button';
import { UsersIcon, DownloadIcon } from '../components/shared/Icons'; // CubeIcon removed from here as it won't be used

import {
    fetchBoards,
    fetchRetailers,
    fetchProvinces,
    fetchDistricts,
    fetchDsDivisions
} from '../services/api';
import {
    BOARD_TYPES, // Should contain 'dealer', 'tin', 'vertical'
    PROVIDER_FILTER_OPTIONS,
    PROVIDERS_CONFIG,
} from '../constants';

interface BoardViewProps {
  viewMode: ViewMode;
  setSidebarFilters: (element: React.ReactNode | null) => void;
}

// Set 'dealer' as the default boardType
const initialBoardViewFilters: BoardFiltersState = {
  boardType: BOARD_TYPES.find(bt => bt.value === 'dealer')?.value || (BOARD_TYPES[0]?.value || 'dealer'), // Default to 'dealer'
  provider: 'all',
  salesRegion: 'all',
  salesDistrict: 'all',
  dsDivision: 'all',
  retailerId: 'all',
};

// Reverted to a more detailed column set for the main data table
const columnsForBoardView = [
  { Header: 'Entry ID', accessor: 'id' },
  { Header: 'Retailer ID', accessor: 'retailerId' },
  { Header: 'Retailer Name', accessor: 'PROFILE_NAME' },
  { Header: 'Board Type', accessor: 'boardType' }, // This specific entry's determined board type
  { Header: 'Provider', accessor: 'provider' },   // This specific entry's determined provider
  { Header: 'Province/Region', accessor: (row: BoardData) => row.PROVINCE || row.SALES_REGION },
  { Header: 'District/Sales Dist.', accessor: (row: BoardData) => row.DISTRICT || row.SALES_DISTRICT },
  { Header: 'DS Division', accessor: 'DS_DIVISION' },
  { Header: 'Sales Area', accessor: 'SALES_AREA' },
  { Header: 'Dialog Name', accessor: 'DIALOG_NAME_BOARD' },
  { Header: 'Mobitel Name', accessor: 'MOBITEL_NAME_BOARD' },
  { Header: 'Hutch Name', accessor: 'HUTCH_NAME_BOARD' },
  { Header: 'Airtel Name', accessor: 'AIRTEL_NAME_BOARD' },
  { Header: 'Dialog Side', accessor: 'DIALOG_SIDE_BOARD' },
  { Header: 'Mobitel Side', accessor: 'MOBITEL_SIDE_BOARD' },
  { Header: 'Hutch Side', accessor: 'HUTCH_SIDE_BOARD' },
  { Header: 'Airtel Side', accessor: 'AIRTEL_SIDE_BOARD' },
  { Header: 'Dialog Tin', accessor: 'DIALOG_TIN_BOARD' },
  { Header: 'Mobitel Tin', accessor: 'MOBITEL_TIN_BOARD' },
  { Header: 'Hutch Tin', accessor: 'HUTCH_TIN_BOARD' },
  { Header: 'Airtel Tin', accessor: 'AIRTEL_TIN_BOARD' },
];


const convertToCSV = (data: any[], columns: { Header: string, accessor: string | ((row: any) => any) }[]): string => {
    const header = columns.map(col => `"${col.Header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            let cellData;
            if (typeof col.accessor === 'function') {
                cellData = col.accessor(row);
            } else {
                 // Ensure accessor is a valid key of BoardData if not a function
                cellData = row[col.accessor as keyof BoardData];
            }
            if (cellData === undefined || cellData === null) cellData = '';
            else if (typeof cellData === 'number') cellData = cellData.toString();
            else if (typeof cellData === 'object') cellData = JSON.stringify(cellData);
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
  const [boardDataCount, setBoardDataCount] = useState<number>(0);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetric[]>([]);
  const [totalSystemRetailers, setTotalSystemRetailers] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [selectedRetailerForOriginalImage, setSelectedRetailerForOriginalImage] = useState<Retailer | null>(null);
  const [detectedBoardImageIdentifier, setDetectedBoardImageIdentifier] = useState<string | undefined>(undefined);

  const [provinceOptions, setProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Loading...' }]);
  const [districtOptions, setDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [dsDivisionOptions, setDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [retailerFilterOptions, setRetailerFilterOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);

  const isSalesView = viewMode === 'sales';
  const geoLabel = isSalesView ? 'Sales Region' : 'Province';
  const districtLabel = isSalesView ? 'Sales District' : 'District';

  const fetchTotalRetailerCount = useCallback(async () => {
    try {
        const allRetailers = await fetchRetailers({}, 'board');
        setTotalSystemRetailers(allRetailers.length);
    } catch (e) {
        console.error("Failed to fetch total board retailer count", e);
        setTotalSystemRetailers(0);
    }
  }, []);

  const fetchDataWithCurrentFilters = useCallback(async (filtersToUse: BoardFiltersState) => {
    setIsLoading(true); setError(null);
    setSelectedRetailerForOriginalImage(null); setDetectedBoardImageIdentifier(undefined);

    try {
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchBoards(filtersToUse);
      setBoardData(data); setBoardDataCount(count); setProviderMetrics(fetchedProviderMetrics);

      const retailerApiFilters: any = {
          provider: filtersToUse.provider, dsDivision: filtersToUse.dsDivision,
          ...(isSalesView ? { salesRegion: filtersToUse.salesRegion, salesDistrict: filtersToUse.salesDistrict }
                          : { province: filtersToUse.salesRegion, district: filtersToUse.salesDistrict }),
      };
      if (filtersToUse.retailerId !== 'all') { retailerApiFilters.retailerId = filtersToUse.retailerId; }

      const retailersForMapData = await fetchRetailers(retailerApiFilters, 'board');
      setMapRetailers(retailersForMapData);

      if (filtersToUse.retailerId && filtersToUse.retailerId !== 'all') {
        const selectedRetailer = retailersForMapData.find(r => r.id === filtersToUse.retailerId);
        setSelectedRetailerForOriginalImage(selectedRetailer || null);
        const relevantBoard = data.find(b => b.retailerId === filtersToUse.retailerId);
        if (relevantBoard) {
            setDetectedBoardImageIdentifier(relevantBoard.detectedBoardImageIdentifier || relevantBoard.originalBoardImageIdentifier);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load board data.");
      setBoardData([]); setBoardDataCount(0); setProviderMetrics([]); setMapRetailers([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSalesView]);

  useEffect(() => {
    fetchTotalRetailerCount();
    fetchDataWithCurrentFilters(initialBoardViewFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTotalRetailerCount]); // Keep fetchDataWithCurrentFilters out of deps for initial call

  const handleFilterChange = useCallback((filterName: keyof BoardFiltersState, value: string) => {
    setCurrentFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'provider') {
            newFilters.salesRegion = 'all'; newFilters.salesDistrict = 'all'; newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'salesRegion' && value !== 'all') {
            newFilters.salesDistrict = 'all'; newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'salesDistrict' && value !== 'all') {
            newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'dsDivision' && value !== 'all') {
            newFilters.retailerId = 'all';
        }
        return newFilters;
    });
  }, []);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, provinces: true}));
    fetchProvinces(currentFilters.provider, isSalesView, 'board').then(options => {
        setProvinceOptions([{ value: 'all', label: `All ${geoLabel}s` }, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, provinces: false})));
  }, [currentFilters.provider, isSalesView, geoLabel]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, districts: true}));
    const provinceToFilterBy = currentFilters.salesRegion === 'all' ? undefined : currentFilters.salesRegion;
    fetchDistricts(currentFilters.provider, provinceToFilterBy, isSalesView, 'board').then(options => {
        setDistrictOptions([{ value: 'all', label: `All ${districtLabel}s` }, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, districts: false})));
  }, [currentFilters.provider, currentFilters.salesRegion, isSalesView, districtLabel]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, dsDivisions: true}));
    const provinceToFilterBy = currentFilters.salesRegion === 'all' ? undefined : currentFilters.salesRegion;
    const districtToFilterBy = currentFilters.salesDistrict === 'all' ? undefined : currentFilters.salesDistrict;
    fetchDsDivisions(currentFilters.provider, provinceToFilterBy, districtToFilterBy, 'board').then(options => {
        setDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, dsDivisions: false})));
  }, [currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, retailers: true}));
    const filtersForRetailerFetch: any = { provider: currentFilters.provider };
    if (currentFilters.salesRegion !== 'all') filtersForRetailerFetch[isSalesView ? 'salesRegion' : 'province'] = currentFilters.salesRegion;
    if (currentFilters.salesDistrict !== 'all') filtersForRetailerFetch[isSalesView ? 'salesDistrict' : 'district'] = currentFilters.salesDistrict;
    if (currentFilters.dsDivision !== 'all') filtersForRetailerFetch.dsDivision = currentFilters.dsDivision;

    fetchRetailers(filtersForRetailerFetch, 'board').then(data => {
        const options = data.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }));
        setRetailerFilterOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, retailers: false})));
  }, [currentFilters.provider, currentFilters.salesRegion, currentFilters.salesDistrict, currentFilters.dsDivision, isSalesView]);

  const applyFiltersAndFetchData = useCallback(() => {
      fetchDataWithCurrentFilters(currentFilters);
  }, [currentFilters, fetchDataWithCurrentFilters]);

  const resetAllFilters = useCallback(() => {
    setCurrentFilters(initialBoardViewFilters);
    fetchDataWithCurrentFilters(initialBoardViewFilters);
  }, [fetchDataWithCurrentFilters]);

  useEffect(() => {
    const filterUI = (
      <FilterPanel title="Board Filters" onApplyFilters={applyFiltersAndFetchData} onResetFilters={resetAllFilters}>
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-600">
            <RadioGroup
              label="Board Type" name="boardType"
              options={BOARD_TYPES} // Removed "All Types" option
              selectedValue={currentFilters.boardType}
              onChange={(value) => handleFilterChange('boardType', value)}
            />
        </div>
        <SelectDropdown
          label="Provider" options={PROVIDER_FILTER_OPTIONS} value={currentFilters.provider}
          onChange={(e) => handleFilterChange('provider', e.target.value)}
          disabled={isLoadingOptions['provinces']}
        />
        <SelectDropdown
          label={geoLabel} options={provinceOptions} value={currentFilters.salesRegion}
          onChange={(e) => handleFilterChange('salesRegion', e.target.value)}
          disabled={isLoadingOptions['provinces'] || isLoadingOptions['districts']}
        />
        <SelectDropdown
          label={districtLabel} options={districtOptions} value={currentFilters.salesDistrict}
          onChange={(e) => handleFilterChange('salesDistrict', e.target.value)}
          disabled={isLoadingOptions['districts'] || isLoadingOptions['dsDivisions']}
        />
         <SelectDropdown
          label="DS Division" options={dsDivisionOptions} value={currentFilters.dsDivision}
          onChange={(e) => handleFilterChange('dsDivision', e.target.value)}
          disabled={isLoadingOptions['dsDivisions'] || isLoadingOptions['retailers']}
        />
        <SelectDropdown
          label="Retailer Name/ID" options={retailerFilterOptions} value={currentFilters.retailerId}
          onChange={(e) => handleFilterChange('retailerId', e.target.value)}
          disabled={isLoadingOptions['retailers']}
        />
      </FilterPanel>
    );
    setSidebarFilters(filterUI);
    return () => { setSidebarFilters(null); };
  }, [
    currentFilters, viewMode, isSalesView, geoLabel, districtLabel,
    handleFilterChange, applyFiltersAndFetchData, resetAllFilters,
    setSidebarFilters, provinceOptions, districtOptions, dsDivisionOptions, retailerFilterOptions,
    isLoadingOptions
  ]);

  const handleDownloadCSV = () => {
    if (boardData.length === 0) { alert("No data to download."); return; }
    const csvString = convertToCSV(boardData, columnsForBoardView);
    downloadCSV(csvString, 'board_data.csv');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Board View ({viewMode === 'sales' ? 'Sales' : 'Admin'})</h2>
      
      {totalSystemRetailers !== null && (
          <div className="mb-6">
            <MetricBox
                title="Total Retailers" // Consistent Label
                value={totalSystemRetailers.toString()}
                icon={<UsersIcon />}
                className="text-center bg-blue-50 dark:bg-blue-900 border-blue-500"
                accentColor="#1E40AF"
            />
          </div>
      )}

      {isLoading && <LoadingSpinner message="Loading board data..." />}
      {error && <ErrorMessage message={error} />}

      {!isLoading && !error && (
        <>
          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
            {/* Map title simplified */}
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Locations</h3>
            <InteractiveMap retailers={mapRetailers} geoJsonData={null} />
          </div>

          {/* Board Counts per Provider moved after the map */}
          <div className="mb-6 p-4 bg-white dark:bg-dark-card rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Board Counts per Provider</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {providerMetrics.map(metric => {
                    const providerConfig = PROVIDERS_CONFIG.find(p => p.name === metric.provider);
                    return (
                        <MetricBox
                            key={metric.provider}
                            title={`${metric.provider} Boards`}
                            value={metric.count?.toString() || '0'}
                            accentColor={providerConfig?.color}
                            providerLogoUrl={providerConfig?.logoUrl}
                            // Icon removed as per request
                        />
                    );
                })}
            </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Counts reflect total boards for each provider based on current filters (including Board Type).</p>
          </div>
          
          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer & Board Images</h3>
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
                        : "Image(s) not available for the selected retailer or board configuration."}
                </p>
            )}
          </div>

          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Board Data Details ({boardDataCount} entries)</h3>
              <Button onClick={handleDownloadCSV} variant="outline" size="sm" disabled={boardData.length === 0} aria-label="Download board data as CSV">
                <DownloadIcon className="w-4 h-4 mr-2"/> Download CSV
              </Button>
            </div>
            <DataTable columns={columnsForBoardView} data={boardData} />
          </div>
        </>
      )}
    </div>
  );
};

export default BoardView;