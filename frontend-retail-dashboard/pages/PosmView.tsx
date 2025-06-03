
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, PosmGeneralFiltersState, PosmData, ProviderMetric, Retailer, FilterOption, GeoJsonCollection } from '../types';
import FilterPanel from '../components/sidebar/FilterPanel';
import SelectDropdown from '../components/shared/SelectDropdown';
import InteractiveMap from '../components/map/InteractiveMap';
import DataTable from '../components/data/DataTable';
import MetricBox from '../components/metrics/MetricBox';
import PercentageBar from '../components/metrics/PercentageBar';
import PosmComparison from '../components/posm/PosmComparison';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorMessage from '../components/shared/ErrorMessage';
import ImageDisplay from '../components/image/ImageDisplay';
import RangeSlider from '../components/shared/RangeSlider';
import { 
    InformationCircleIcon, 
    MapIcon, 
    ArrowsRightLeftIcon,
    IconProps
} from '../components/shared/Icons';
import { 
    PROVIDER_FILTER_OPTIONS, 
    PROVINCES, 
    POSM_STATUSES, 
    PROVIDERS_CONFIG,
    ALL_DISTRICTS_OPTIONS, 
    ALL_DS_DIVISIONS_OPTIONS
} from '../constants';
import { fetchPosmGeneral, fetchRetailers, fetchGeoDistricts, fetchAvailableBatches } from '../services/api';

type PosmSubView = 'general' | 'district' | 'comparison';

interface PosmViewProps {
  viewMode: ViewMode;
  setSidebarFilters: (element: React.ReactNode | null) => void;
}

const initialGeneralFilters: PosmGeneralFiltersState = {
  provider: 'all',
  province: 'all',
  district: 'all',
  dsDivision: 'all',
  retailerId: 'all',
  posmStatus: 'all',
  visibilityRange: [0, 100], 
};

const initialComparisonGeoFilters = {
    province: 'all',
    district: 'all',
    dsDivision: 'all',
};

const DEFAULT_POSM_STATUS_LABEL = "POSM Status";
const DEFAULT_VISIBILITY_PERCENTAGE_LABEL = "POSM Visibility Percentage";

const subViewIcons: Record<PosmSubView, React.ReactElement<IconProps>> = {
    general: <InformationCircleIcon />,
    district: <MapIcon />,
    comparison: <ArrowsRightLeftIcon />,
};

const PosmView: React.FC<PosmViewProps> = ({ viewMode, setSidebarFilters }) => {
  const [subView, setSubView] = useState<PosmSubView>('general');
  const [generalFilters, setGeneralFilters] = useState<PosmGeneralFiltersState>(initialGeneralFilters);
  
  const [posmData, setPosmData] = useState<PosmData[]>([]);
  const [retailerCount, setRetailerCount] = useState<number>(0);
  const [providerPosmMetrics, setProviderPosmMetrics] = useState<ProviderMetric[]>([]);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [geoJsonDistricts, setGeoJsonDistricts] = useState<GeoJsonCollection | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRetailersForComparison, setIsLoadingRetailersForComparison] = useState<boolean>(false);


  const [availableBatches, setAvailableBatches] = useState<FilterOption[]>([]);
  
  // State for POSM Comparison sidebar
  const [comparisonGeoFilters, setComparisonGeoFilters] = useState(initialComparisonGeoFilters);
  const [comparisonRetailerOptions, setComparisonRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);
  const [comparisonRetailerId, setComparisonRetailerId] = useState<string>('all');
  const [generalRetailerOptions, setGeneralRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);


  const [selectedRetailerImageId, setSelectedRetailerImageId] = useState<string | undefined>(undefined);


  const handleGeneralFilterChange = useCallback((filterName: keyof PosmGeneralFiltersState, value: string | [number, number]) => {
    setGeneralFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'provider' && value === 'all') {
            newFilters.posmStatus = 'all'; 
            newFilters.visibilityRange = [0, 100]; 
        }
        // If province/district/dsDivision changes, reset retailerId if not 'all' to avoid inconsistency
        if (['province', 'district', 'dsDivision'].includes(filterName) && newFilters.retailerId !== 'all') {
            // newFilters.retailerId = 'all'; // This might be too aggressive, user might want to keep retailer
        }
        return newFilters;
    });
  }, []);

  const handleVisibilityRangeChange = useCallback((values: [number, number]) => {
    handleGeneralFilterChange('visibilityRange', values);
  }, [handleGeneralFilterChange]);

  const handleComparisonGeoFilterChange = useCallback((filterName: keyof typeof initialComparisonGeoFilters, value: string) => {
    setComparisonGeoFilters(prev => ({...prev, [filterName]: value}));
    // When geo filters for comparison change, retailer selection should ideally reset or re-validate.
    // For now, fetching new retailer list will handle this.
  }, []);


  const applyGeneralFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, count, providerMetrics } = await fetchPosmGeneral(generalFilters);
      setPosmData(data);
      setRetailerCount(count);
      setProviderPosmMetrics(providerMetrics);

      const retailerLocationFilters = { 
          province: generalFilters.province,
          district: generalFilters.district,
          dsDivision: generalFilters.dsDivision,
          retailerId: generalFilters.retailerId,
      };
      const [retailersForMap, fetchedGeneralRetailers] = await Promise.all([
          fetchRetailers(retailerLocationFilters),
          fetchRetailers({ // For the general filter dropdown
              province: generalFilters.province,
              district: generalFilters.district,
              dsDivision: generalFilters.dsDivision,
          })
      ]);
      setMapRetailers(retailersForMap);
      setGeneralRetailerOptions([{value: 'all', label: 'All Retailers'}, ...fetchedGeneralRetailers.map(r => ({value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})`}))]);
      
      if (generalFilters.retailerId !== 'all') {
        const selectedRetailer = retailersForMap.find(r => r.id === generalFilters.retailerId);
        setSelectedRetailerImageId(selectedRetailer?.imageIdentifier);
      } else {
        setSelectedRetailerImageId(undefined);
      }

      if (subView === 'district') {
        const geoData = await fetchGeoDistricts();
        setGeoJsonDistricts(geoData);
      }

    } catch (err) {
      console.error("Failed to fetch POSM data:", err);
      setError("Failed to load POSM data. Please try again.");
      setSelectedRetailerImageId(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [generalFilters, subView]);


  const resetGeneralFilters = useCallback(() => {
    setGeneralFilters(initialGeneralFilters);
    setSelectedRetailerImageId(undefined);
    // applyGeneralFilters will be called by useEffect for generalFilters
  }, []);

  const resetComparisonFilters = useCallback(() => {
    setComparisonGeoFilters(initialComparisonGeoFilters);
    setComparisonRetailerId('all');
    setAvailableBatches([]); // Clear batches as retailer is reset
    // Fetch initial full list of retailers for comparison
    setIsLoadingRetailersForComparison(true);
    fetchRetailers({}).then(retailers => {
        setComparisonRetailerOptions([{value: 'all', label: 'All Retailers'}, ...retailers.map(r => ({value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})`}))]);
    }).catch(err => {
        console.error("Failed to fetch retailers for comparison reset:", err);
        setError("Failed to load retailer options.");
    }).finally(() => setIsLoadingRetailersForComparison(false));
  }, []);
  
  // Fetch retailers for comparison sidebar when its geo filters change
  useEffect(() => {
    if (subView === 'comparison') {
      setIsLoadingRetailersForComparison(true);
      fetchRetailers(comparisonGeoFilters)
        .then(retailers => {
          const options = [{value: 'all', label: 'All Retailers'}, ...retailers.map(r => ({value: r.id, label: `${r.name} (${r.district || r.province || 'N/A'})`}))];
          setComparisonRetailerOptions(options);
          // If current comparisonRetailerId is not in new options, reset it
          if (comparisonRetailerId !== 'all' && !options.find(opt => opt.value === comparisonRetailerId)) {
            setComparisonRetailerId('all');
            setAvailableBatches([]); // Clear batches as retailer has changed
          }
        })
        .catch(err => {
          console.error("Failed to fetch retailers for comparison sidebar:", err);
          setError("Failed to load retailer options for comparison.");
          setComparisonRetailerOptions([{ value: 'all', label: 'All Retailers' }]);
        })
        .finally(() => setIsLoadingRetailersForComparison(false));
    }
  }, [comparisonGeoFilters, subView, comparisonRetailerId]);


  // Fetch batches when comparisonRetailerId (from sidebar for comparison view) changes
  useEffect(() => {
    if (subView === 'comparison' && comparisonRetailerId && comparisonRetailerId !== 'all') {
      setIsLoading(true); // Show loading while batches are fetched
      fetchAvailableBatches(comparisonRetailerId)
        .then(batches => {
            setAvailableBatches(batches);
            if (batches.length === 0) {
                setError("No batches available for the selected retailer for comparison.");
            }
        })
        .catch(err => {
            console.error("Failed to fetch batches:", err);
            setError("Failed to load batch options for comparison.");
            setAvailableBatches([]);
        })
        .finally(() => setIsLoading(false));
    } else {
      setAvailableBatches([]);
    }
  }, [comparisonRetailerId, subView]);

  useEffect(() => {
    if (subView === 'general' || subView === 'district') {
      applyGeneralFilters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalFilters, subView]); 
  

  useEffect(() => {
    if (subView === 'general' || subView === 'district') {
        const selectedProviderConfig = PROVIDERS_CONFIG.find(p => p.value === generalFilters.provider);
        const posmStatusLabel = selectedProviderConfig && generalFilters.provider !== 'all' 
            ? `POSM ${selectedProviderConfig.label} Status` 
            : DEFAULT_POSM_STATUS_LABEL;

        const showProviderSpecificFilters = generalFilters.provider !== 'all';

        const filterUI = (
            <FilterPanel 
                title={`${subView.charAt(0).toUpperCase() + subView.slice(1)} POSM Filters`} 
                onApplyFilters={applyGeneralFilters} 
                onResetFilters={resetGeneralFilters}
            >
                <SelectDropdown
                    label="Provider"
                    options={PROVIDER_FILTER_OPTIONS}
                    value={generalFilters.provider}
                    onChange={(e) => handleGeneralFilterChange('provider', e.target.value)}
                />
                {showProviderSpecificFilters && subView === 'general' && (
                  <>
                    <SelectDropdown
                        label={posmStatusLabel}
                        options={POSM_STATUSES}
                        value={generalFilters.posmStatus}
                        onChange={(e) => handleGeneralFilterChange('posmStatus', e.target.value)}
                    />
                    <RangeSlider
                        label={DEFAULT_VISIBILITY_PERCENTAGE_LABEL}
                        min={0}
                        max={100}
                        initialValues={generalFilters.visibilityRange}
                        onChangeCommitted={handleVisibilityRangeChange}
                    />
                  </>
                )}
                <SelectDropdown
                    label="Province"
                    options={PROVINCES}
                    value={generalFilters.province}
                    onChange={(e) => handleGeneralFilterChange('province', e.target.value)}
                />
                <SelectDropdown
                    label="District"
                    options={ALL_DISTRICTS_OPTIONS}
                    value={generalFilters.district}
                    onChange={(e) => handleGeneralFilterChange('district', e.target.value)}
                />
                <SelectDropdown
                    label="DS Division"
                    options={ALL_DS_DIVISIONS_OPTIONS}
                    value={generalFilters.dsDivision}
                    onChange={(e) => handleGeneralFilterChange('dsDivision', e.target.value)}
                />
                <SelectDropdown
                    label="Retailer Name/ID"
                    options={generalRetailerOptions} 
                    value={generalFilters.retailerId}
                    onChange={(e) => handleGeneralFilterChange('retailerId', e.target.value)}
                    disabled={isLoading} // Disable while general retailers are loading from its own filters
                />
            </FilterPanel>
        );
        setSidebarFilters(filterUI);
    } else if (subView === 'comparison') {
        const comparisonFilterUI = (
            <FilterPanel
                title="Comparison Filters"
                onApplyFilters={() => { /* Geo filters apply on change, retailer selection triggers batch fetch */ }}
                onResetFilters={resetComparisonFilters}
            >
                <SelectDropdown
                    label="Province"
                    options={PROVINCES}
                    value={comparisonGeoFilters.province}
                    onChange={(e) => handleComparisonGeoFilterChange('province', e.target.value)}
                />
                <SelectDropdown
                    label="District"
                    options={ALL_DISTRICTS_OPTIONS}
                    value={comparisonGeoFilters.district}
                    onChange={(e) => handleComparisonGeoFilterChange('district', e.target.value)}
                />
                <SelectDropdown
                    label="DS Division"
                    options={ALL_DS_DIVISIONS_OPTIONS}
                    value={comparisonGeoFilters.dsDivision}
                    onChange={(e) => handleComparisonGeoFilterChange('dsDivision', e.target.value)}
                />
                <SelectDropdown
                    label="Retailer Name/ID"
                    options={comparisonRetailerOptions} 
                    value={comparisonRetailerId}
                    onChange={(e) => setComparisonRetailerId(e.target.value)}
                    disabled={isLoadingRetailersForComparison}
                />
                {isLoadingRetailersForComparison && <LoadingSpinner size="sm" message="Loading retailers..." />}
            </FilterPanel>
        );
        setSidebarFilters(comparisonFilterUI);
    } else {
        setSidebarFilters(null);
    }

    return () => {
      setSidebarFilters(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subView, 
    generalFilters, 
    viewMode, 
    applyGeneralFilters, 
    resetGeneralFilters, 
    handleGeneralFilterChange, 
    handleVisibilityRangeChange, 
    comparisonGeoFilters, 
    comparisonRetailerId, 
    comparisonRetailerOptions,
    generalRetailerOptions, 
    handleComparisonGeoFilterChange, 
    resetComparisonFilters, 
    setSidebarFilters,
    isLoadingRetailersForComparison,
    isLoading // general loading state
  ]);


  const renderSubViewContent = () => {
    if (isLoading && !(subView === 'comparison' && comparisonData)) return <LoadingSpinner message="Loading POSM data..." />;
    if (error && subView !== 'comparison') return <ErrorMessage message={error} />; // Comparison handles its own errors mostly

    switch (subView) {
      case 'general':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <MetricBox title="Total Retailers (POSM)" value={retailerCount.toString()} />
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer POSM Locations</h3>
              <InteractiveMap retailers={mapRetailers} geoJsonData={null} />
            </div>
            <div className="space-y-4 mb-6 bg-white dark:bg-dark-card p-4 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Provider POSM Visibility</h3>
                {providerPosmMetrics.map(metric => {
                    const providerConfig = PROVIDERS_CONFIG.find(p => p.name === metric.provider);
                    return (
                        <PercentageBar 
                            key={metric.provider} 
                            label={metric.provider} 
                            percentage={metric.percentage || 0} 
                            color={providerConfig?.color || '#718096'}
                            providerLogoUrl={providerConfig?.logoUrl}
                        />
                    );
                })}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Image</h3>
              {generalFilters.retailerId !== 'all' && selectedRetailerImageId ? (
                <ImageDisplay imageIdentifier={selectedRetailerImageId} altText={`Image for retailer ${generalFilters.retailerId}`} className="w-full max-w-md h-auto mx-auto" />
              ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {generalFilters.retailerId !== 'all' && !selectedRetailerImageId 
                        ? "Image not available for the selected retailer."
                        : "Select a specific retailer to view their image."}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">POSM Data Details</h3>
              <DataTable
                columns={[
                  { Header: 'ID', accessor: 'id' },
                  { Header: 'Retailer ID', accessor: 'retailerId' },
                  { Header: 'Provider', accessor: 'provider' },
                  { Header: 'Visibility %', accessor: 'visibilityPercentage' },
                ]}
                data={posmData}
              />
            </div>
          </>
        );
      case 'district':
        return (
          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">District POSM Visibility (Choropleth)</h3>
            {isLoading ? <LoadingSpinner message="Loading map data..."/> : 
             geoJsonDistricts ? (
              <InteractiveMap retailers={[]} geoJsonData={geoJsonDistricts} />
            ) : (
              <p className="dark:text-gray-300">Map data not available or failed to load.</p>
            )}
             <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Choropleth map showing POSM metrics by district. Colors would be based on data fetched and merged with GeoJSON.</p>
          </div>
        );
      case 'comparison':
        return (
            <PosmComparison 
                retailerOptions={comparisonRetailerOptions} 
                selectedRetailerId={comparisonRetailerId}
                batchOptions={availableBatches}
            />
        );
      default:
        return null;
    }
  };
  
  const [comparisonData, setComparisonData] = useState<any>(null); 
  useEffect(() => {
    if (subView !== 'comparison') {
        setComparisonData(null); 
    }
    if (subView !== 'comparison' && error && (error.includes("batch") || error.includes("comparison"))){
        setError(null);
    }
    if (subView === 'comparison' && error && !(error.includes("batch") || error.includes("comparison"))) {
        setError(null);
    }
  }, [subView, error]);


  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">POSM View ({viewMode === 'sales' ? 'Sales' : 'Admin'})</h2>

      <div className="flex space-x-1 border-b border-gray-300 dark:border-gray-700 mb-4">
        {(['general', 'district', 'comparison'] as PosmSubView[]).map(sv => (
          <button
            key={sv}
            onClick={() => setSubView(sv)}
            className={`px-3 py-2 font-medium text-sm capitalize rounded-t-md focus:outline-none transition-colors flex items-center justify-center
              ${subView === sv 
                ? 'bg-primary text-white dark:bg-secondary' 
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
            aria-current={subView === sv ? "page" : undefined}
          >
            {React.cloneElement(subViewIcons[sv], { 
              className: `w-4 h-4 mr-2 ${subView === sv ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`
            })}
            {`${sv.charAt(0).toUpperCase() + sv.slice(1)} View`}
          </button>
        ))}
      </div>
      
      {renderSubViewContent()}
    </div>
  );
};

export default PosmView;
