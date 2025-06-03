
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, BoardFiltersState, BoardData, ProviderMetric, Retailer } from '../types';
import FilterPanel from '../components/sidebar/FilterPanel';
import SelectDropdown from '../components/shared/SelectDropdown';
import RadioGroup from '../components/shared/RadioGroup';
import InteractiveMap from '../components/map/InteractiveMap';
import DataTable from '../components/data/DataTable';
import MetricBox from '../components/metrics/MetricBox';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorMessage from '../components/shared/ErrorMessage';
import ImageDisplay from '../components/image/ImageDisplay';
import ImageModal from '../components/shared/ImageModal';
import Button from '../components/shared/Button';
import { UsersIcon, EyeIcon, DownloadIcon } from '../components/shared/Icons';

import { 
    BOARD_TYPES, 
    PROVIDER_FILTER_OPTIONS, 
    PROVINCES, 
    RETAILERS_EXAMPLE, 
    PROVIDERS_CONFIG,
    ALL_DISTRICTS_OPTIONS, // New import for flat list
    ALL_DS_DIVISIONS_OPTIONS // New import for flat list
} from '../constants';
import { fetchBoards, fetchRetailers } from '../services/api';

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

const columnsForDataTable = [
    { Header: 'ID', accessor: 'id' },
    { Header: 'Retailer ID', accessor: 'retailerId' },
    { Header: 'Board Type', accessor: 'boardType' },
    { Header: 'Provider', accessor: 'provider' },
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
  
  const [selectedRetailerForImage, setSelectedRetailerForImage] = useState<Retailer | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [largeImageModalUrl, setLargeImageModalUrl] = useState<string | undefined>(undefined);

  const sampleRetailerPlaceholderImage = "/assets/sample-retailer-placeholder.png";

  const handleFilterChange = useCallback((filterName: keyof BoardFiltersState, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  }, []); 
  
  const applyFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedRetailerForImage(null); 
    try {
      // Pass all filters; backend should handle combination logic.
      // salesRegion, salesDistrict, dsDivision are all passed.
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchBoards(filters);
      setBoardData(data);
      setRetailerDataCount(count); 
      setProviderMetrics(fetchedProviderMetrics);

      const retailersForMap = await fetchRetailers(filters); 
      setMapRetailers(retailersForMap);

      if (filters.retailerId !== 'all') {
        const selected = retailersForMap.find(r => r.id === filters.retailerId);
        setSelectedRetailerForImage(selected || null);
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
    setSelectedRetailerForImage(null);
    // applyFilters will be called by the useEffect for filters
  }, []); 

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFilters]);

  const handleViewLargeImage = () => {
    const imageUrl = selectedRetailerForImage?.imageIdentifier 
        ? `https://picsum.photos/seed/${encodeURIComponent(selectedRetailerForImage.imageIdentifier)}/800/600`
        : (filters.retailerId === 'all' || !selectedRetailerForImage) ? sampleRetailerPlaceholderImage : undefined;

    if (imageUrl) {
        setLargeImageModalUrl(imageUrl);
        setIsImageModalOpen(true);
    }
  };
  
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
      <FilterPanel title="Board Filters" onApplyFilters={applyFilters} onResetFilters={resetFilters}>
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
          options={PROVINCES}
          value={filters.salesRegion}
          onChange={(e) => handleFilterChange('salesRegion', e.target.value)}
        />
        <SelectDropdown
          label={viewMode === 'sales' ? "Sales District" : "District"}
          options={ALL_DISTRICTS_OPTIONS} // Use flat list
          value={filters.salesDistrict}
          onChange={(e) => handleFilterChange('salesDistrict', e.target.value)}
          // disabled prop removed
        />
         <SelectDropdown
          label="DS Division"
          options={ALL_DS_DIVISIONS_OPTIONS} // Use flat list
          value={filters.dsDivision}
          onChange={(e) => handleFilterChange('dsDivision', e.target.value)}
          // disabled prop removed
        />
        <SelectDropdown
          label="Retailer Name/ID"
          options={RETAILERS_EXAMPLE} 
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
  }, [filters, viewMode, applyFilters, resetFilters, handleFilterChange, setSidebarFilters]);


  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Board View ({viewMode === 'sales' ? 'Sales' : 'Admin'})</h2>
      
      {isLoading && <LoadingSpinner message="Loading board data..." />}
      {error && <ErrorMessage message={error} />}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <MetricBox 
                title="Retailer Count" 
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
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Retailer Image</h3>
            </div>
            <div className="text-center">
                <ImageDisplay 
                    imageIdentifier={selectedRetailerForImage?.imageIdentifier} 
                    defaultImageUrl={sampleRetailerPlaceholderImage}
                    altText={selectedRetailerForImage ? `Image for ${selectedRetailerForImage.name}` : "Sample retailer image"} 
                    className="w-full max-w-md h-auto mx-auto mb-2" 
                />
                {(selectedRetailerForImage?.imageIdentifier || filters.retailerId === 'all' || !selectedRetailerForImage) && (
                     <Button 
                        onClick={handleViewLargeImage} 
                        variant="ghost" 
                        size="sm"
                        className="text-primary dark:text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label="View larger image"
                      >
                        <EyeIcon className="w-5 h-5 mr-1" /> View Large
                    </Button>
                )}
                {!selectedRetailerForImage && filters.retailerId !== 'all' && (
                     <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        Image not available for the selected retailer.
                    </p>
                )}
                 {filters.retailerId === 'all' && !selectedRetailerForImage && (
                     <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        Select a specific retailer to view their image.
                    </p>
                )}
            </div>
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
      <ImageModal 
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={largeImageModalUrl || sampleRetailerPlaceholderImage}
        altText="Enlarged retailer image"
      />
    </div>
  );
};

export default BoardView;
