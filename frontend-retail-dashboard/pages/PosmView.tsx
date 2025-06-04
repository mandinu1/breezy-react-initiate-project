// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/pages/PosmView.tsx
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
import Button from '../components/shared/Button';
import { 
    InformationCircleIcon, 
    MapIcon, 
    ArrowsRightLeftIcon,
    DownloadIcon,
    IconProps
} from '../components/shared/Icons';
import { 
    PROVIDER_FILTER_OPTIONS, 
    POSM_STATUSES, 
    PROVIDERS_CONFIG,
} from '../constants'; // Removed PROVINCES, ALL_DISTRICTS_OPTIONS, etc.
import { 
    fetchPosmGeneral, 
    fetchRetailers, 
    fetchGeoDistricts, 
    fetchAvailableBatches,
    fetchProvinces,
    fetchDistricts,
    fetchDsDivisions 
} from '../services/api';

type PosmSubView = 'general' | 'district' | 'comparison';

interface PosmViewProps {
  viewMode: ViewMode;
  setSidebarFilters: (element: React.ReactNode | null) => void;
}

const initialPosmViewFilters: PosmGeneralFiltersState = { // Renamed for clarity within this file
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

const columnsForPosmTable = [
    { Header: 'POSM ID', accessor: 'id' },
    { Header: 'Retailer ID', accessor: 'retailerId' },
    { Header: 'Profile Name', accessor: 'PROFILE_NAME'}, 
    { Header: 'Province', accessor: 'PROVINCE'},
    { Header: 'District', accessor: 'DISTRICT'},
    { Header: 'DS Division', accessor: 'DS_DIVISION' },
    { Header: 'GN Division', accessor: 'GN_DIVISION' },
    { Header: 'Sales Region', accessor: 'SALES_REGION' },
    { Header: 'Sales District', accessor: 'SALES_DISTRICT' },
    { Header: 'Sales Area', accessor: 'SALES_AREA' },
    { Header: 'Dialog Area %', accessor: 'DIALOG_AREA_PERCENTAGE' },
    { Header: 'Airtel Area %', accessor: 'AIRTEL_AREA_PERCENTAGE' },
    { Header: 'Mobitel Area %', accessor: 'MOBITEL_AREA_PERCENTAGE' },
    { Header: 'Hutch Area %', accessor: 'HUTCH_AREA_PERCENTAGE' },
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

const PosmView: React.FC<PosmViewProps> = ({ viewMode, setSidebarFilters }) => {
  const [subView, setSubView] = useState<PosmSubView>('general');
  const [currentGeneralFilters, setCurrentGeneralFilters] = useState<PosmGeneralFiltersState>(initialPosmViewFilters);
  
  const [posmData, setPosmData] = useState<PosmData[]>([]); 
  const [posmDataCount, setPosmDataCount] = useState<number>(0);
  const [providerPosmMetrics, setProviderPosmMetrics] = useState<ProviderMetric[]>([]);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [geoJsonDistricts, setGeoJsonDistricts] = useState<GeoJsonCollection | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [generalProvinceOptions, setGeneralProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Provinces' }]);
  const [generalDistrictOptions, setGeneralDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [generalDsDivisionOptions, setGeneralDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [generalRetailerOptions, setGeneralRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);

  const [isLoadingRetailersForComparison, setIsLoadingRetailersForComparison] = useState<boolean>(false);
  const [availableBatches, setAvailableBatches] = useState<FilterOption[]>([]);
  const [comparisonGeoFilters, setComparisonGeoFilters] = useState(initialComparisonGeoFilters);
  const [comparisonProvinceOptions, setComparisonProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Provinces' }]);
  const [comparisonDistrictOptions, setComparisonDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [comparisonDsDivisionOptions, setComparisonDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [comparisonRetailerOptions, setComparisonRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);
  const [comparisonRetailerId, setComparisonRetailerId] = useState<string>('all');

  const [selectedRetailerImageId, setSelectedRetailerImageId] = useState<string | undefined>(undefined);
  const isSalesView = viewMode === 'sales';

  const handleGeneralFilterChange = useCallback((filterName: keyof PosmGeneralFiltersState, value: string | [number, number]) => {
    setCurrentGeneralFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'provider') {
            newFilters.province = 'all'; newFilters.district = 'all'; newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
            newFilters.posmStatus = 'all'; newFilters.visibilityRange = [0, 100]; 
        } else if (filterName === 'province') {
            newFilters.district = 'all'; newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'district') {
            newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'dsDivision') {
            newFilters.retailerId = 'all';
        }
        return newFilters;
    });
  }, []);

  const handleVisibilityRangeChange = useCallback((values: [number, number]) => {
    handleGeneralFilterChange('visibilityRange', values);
  }, [handleGeneralFilterChange]);

  const handleComparisonGeoFilterChange = useCallback((filterName: keyof typeof initialComparisonGeoFilters, value: string) => {
    setComparisonGeoFilters(prev => {
        const newFilters = {...prev, [filterName]: value};
         if (filterName === 'province') {
            newFilters.district = 'all'; newFilters.dsDivision = 'all';
        } else if (filterName === 'district') {
            newFilters.dsDivision = 'all';
        }
        // When geo filters for comparison change, retailer selection should ideally reset or re-validate.
        // This is handled by the useEffect that fetches comparisonRetailerOptions
        return newFilters;
    });
  }, []);

  // Fetching logic for General/District sub-view filters
  useEffect(() => {
    fetchProvinces(currentGeneralFilters.provider, isSalesView).then(options => {
        setGeneralProvinceOptions([{value: 'all', label: isSalesView ? 'All Sales Regions' : 'All Provinces'}, ...options]);
    });
  }, [currentGeneralFilters.provider, isSalesView]);

  useEffect(() => {
    const { provider, province } = currentGeneralFilters;
    const provinceLabel = isSalesView ? 'All Sales Districts' : 'All Districts';
    if (province && province !== 'all') {
      setGeneralDistrictOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDistricts(provider, province, isSalesView).then(options => {
        setGeneralDistrictOptions([{value: 'all', label: provinceLabel}, ...options]);
      });
    } else {
      setGeneralDistrictOptions([{ value: 'all', label: provinceLabel }]);
    }
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, isSalesView]);

  useEffect(() => {
    const { provider, province, district } = currentGeneralFilters;
    if (district && district !== 'all') {
      setGeneralDsDivisionOptions([{ value: 'all', label: 'Loading...' }]);
      fetchDsDivisions(provider, province, district).then(options => {
        setGeneralDsDivisionOptions([{value: 'all', label: 'All DS Divisions'}, ...options]);
      });
    } else {
      setGeneralDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }]);
    }
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, currentGeneralFilters.district]);

  useEffect(() => {
    const { provider, province, district, dsDivision } = currentGeneralFilters;
    const geoFiltersForRetailers: any = {};
    if (provider !== 'all') geoFiltersForRetailers.provider = provider;
    if (province !== 'all') geoFiltersForRetailers.province = province;
    if (district !== 'all') geoFiltersForRetailers.district = district;
    if (dsDivision !== 'all') geoFiltersForRetailers.dsDivision = dsDivision;
    
    setGeneralRetailerOptions([{ value: 'all', label: 'Loading Retailers...' }]);
    fetchRetailers(geoFiltersForRetailers).then(data => {
        const options = data.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }));
        setGeneralRetailerOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    });
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, currentGeneralFilters.district, currentGeneralFilters.dsDivision]);

  const fetchDataForGeneralSubView = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, count, providerMetrics } = await fetchPosmGeneral(currentGeneralFilters);
      setPosmData(data);
      setPosmDataCount(count);
      setProviderPosmMetrics(providerMetrics);

      const retailerLocationFilters = { ...currentGeneralFilters };
      const retailersForMap = await fetchRetailers(retailerLocationFilters);
      setMapRetailers(retailersForMap);
      
      if (currentGeneralFilters.retailerId !== 'all') {
        const selectedRetailer = retailersForMap.find(r => r.id === currentGeneralFilters.retailerId);
        setSelectedRetailerImageId(selectedRetailer?.imageIdentifier);
      } else {
        setSelectedRetailerImageId(undefined);
      }
      if (subView === 'district') {
        const geoData = await fetchGeoDistricts();
        setGeoJsonDistricts(geoData);
      }
    } catch (err) { /* ... */ } 
    finally { setIsLoading(false); }
  }, [currentGeneralFilters, subView]);

  const resetGeneralFilters = useCallback(() => {
    setCurrentGeneralFilters(initialPosmViewFilters);
    setSelectedRetailerImageId(undefined);
  }, []);

  // Comparison view logic
  const resetComparisonFilters = useCallback(() => {
    setComparisonGeoFilters(initialComparisonGeoFilters);
    setComparisonRetailerId('all');
    setAvailableBatches([]); 
    setIsLoadingRetailersForComparison(true);
    fetchRetailers({})
        .then(retailers => {
            setComparisonRetailerOptions([{value: 'all', label: 'All Retailers'}, ...retailers.map(r => ({value: r.id, label: `${r.id} - ${r.name}`}))]);
        })
        .catch(err => { /* ... */ })
        .finally(() => setIsLoadingRetailersForComparison(false));
  }, []);
  
  useEffect(() => {
    if (subView === 'comparison') {
      fetchProvinces(undefined, isSalesView).then(options => {
          setComparisonProvinceOptions([{ value: 'all', label: isSalesView ? 'All Sales Regions' : 'All Provinces' }, ...options]);
      });
    }
  }, [subView, isSalesView]);

  useEffect(() => {
    if (subView === 'comparison') {
      const { province } = comparisonGeoFilters;
      const label = isSalesView ? 'All Sales Districts' : 'All Districts';
      if (province && province !== 'all') {
        setComparisonDistrictOptions([{ value: 'all', label: 'Loading...' }]);
        fetchDistricts(undefined, province, isSalesView).then(options => {
          setComparisonDistrictOptions([{ value: 'all', label: label }, ...options]);
        });
      } else {
        setComparisonDistrictOptions([{ value: 'all', label: label }]);
      }
    }
  }, [comparisonGeoFilters.province, subView, isSalesView]);

  useEffect(() => {
    if (subView === 'comparison') {
      const { province, district } = comparisonGeoFilters;
      if (district && district !== 'all') {
        setComparisonDsDivisionOptions([{ value: 'all', label: 'Loading...' }]);
        fetchDsDivisions(undefined, province, district).then(options => {
          setComparisonDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }, ...options]);
        });
      } else {
        setComparisonDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }]);
      }
    }
  }, [comparisonGeoFilters.province, comparisonGeoFilters.district, subView]);
  
  useEffect(() => {
    if (subView === 'comparison') {
      setIsLoadingRetailersForComparison(true);
      const { province, district, dsDivision } = comparisonGeoFilters;
      const currentCompFiltersForRetailer: any = {};
      if (province !== 'all') currentCompFiltersForRetailer.province = province;
      if (district !== 'all') currentCompFiltersForRetailer.district = district;
      if (dsDivision !== 'all') currentCompFiltersForRetailer.dsDivision = dsDivision;

      fetchRetailers(currentCompFiltersForRetailer)
        .then(retailers => {
          const options = [{value: 'all', label: 'All Retailers'}, ...retailers.map(r => ({value: r.id, label: `${r.id} - ${r.name}`}))];
          setComparisonRetailerOptions(options);
          if (comparisonRetailerId !== 'all' && !options.find(opt => opt.value === comparisonRetailerId)) {
            setComparisonRetailerId('all'); 
            setAvailableBatches([]); 
          }
        })
        .catch(err => { /* ... */})
        .finally(() => setIsLoadingRetailersForComparison(false));
    }
  }, [comparisonGeoFilters, subView, comparisonRetailerId]);

  useEffect(() => {
    if (subView === 'comparison' && comparisonRetailerId && comparisonRetailerId !== 'all') {
      setIsLoading(true); 
      fetchAvailableBatches(comparisonRetailerId)
        .then(setAvailableBatches)
        .catch(err => { /* ... */ })
        .finally(() => setIsLoading(false));
    } else {
      setAvailableBatches([]);
    }
  }, [comparisonRetailerId, subView]);

  // Effect for setting sidebar filters UI
  useEffect(() => {
    if (subView === 'general' || subView === 'district') {
        const selectedProviderConfig = PROVIDERS_CONFIG.find(p => p.value === currentGeneralFilters.provider);
        const posmStatusLabel = selectedProviderConfig && currentGeneralFilters.provider !== 'all' 
            ? `POSM ${selectedProviderConfig.label} Status` : DEFAULT_POSM_STATUS_LABEL;
        const showProviderSpecificFilters = currentGeneralFilters.provider !== 'all';

        const filterUI = (
            <FilterPanel 
                title={`${subView.charAt(0).toUpperCase() + subView.slice(1)} POSM Filters`} 
                onApplyFilters={fetchDataForGeneralSubView} 
                onResetFilters={resetGeneralFilters}
            >
                <SelectDropdown label="Provider" options={PROVIDER_FILTER_OPTIONS} value={currentGeneralFilters.provider} onChange={(e) => handleGeneralFilterChange('provider', e.target.value)} />
                {showProviderSpecificFilters && subView === 'general' && (
                  <>
                    <SelectDropdown label={posmStatusLabel} options={POSM_STATUSES} value={currentGeneralFilters.posmStatus} onChange={(e) => handleGeneralFilterChange('posmStatus', e.target.value)} />
                    <RangeSlider label={DEFAULT_VISIBILITY_PERCENTAGE_LABEL} min={0} max={100} initialValues={currentGeneralFilters.visibilityRange} onChangeCommitted={handleVisibilityRangeChange} />
                  </>
                )}
                <SelectDropdown label={isSalesView ? "Sales Region" : "Province"} options={generalProvinceOptions} value={currentGeneralFilters.province} onChange={(e) => handleGeneralFilterChange('province', e.target.value)} disabled={currentGeneralFilters.provider === 'all' && generalProvinceOptions.length <=1 }/>
                <SelectDropdown label={isSalesView ? "Sales District" : "District"} options={generalDistrictOptions} value={currentGeneralFilters.district} onChange={(e) => handleGeneralFilterChange('district', e.target.value)} disabled={currentGeneralFilters.province === 'all' && generalDistrictOptions.length <= 1}/>
                <SelectDropdown label="DS Division" options={generalDsDivisionOptions} value={currentGeneralFilters.dsDivision} onChange={(e) => handleGeneralFilterChange('dsDivision', e.target.value)} disabled={currentGeneralFilters.district === 'all' && generalDsDivisionOptions.length <= 1}/>
                <SelectDropdown 
                    label="Retailer Name/ID" 
                    options={generalRetailerOptions} 
                    value={currentGeneralFilters.retailerId} 
                    onChange={(e) => handleGeneralFilterChange('retailerId', e.target.value)} 
                    disabled={isLoading || (currentGeneralFilters.provider === 'all' && currentGeneralFilters.province === 'all' && currentGeneralFilters.district === 'all' && currentGeneralFilters.dsDivision === 'all' && generalRetailerOptions.length <=1 )}
                />
            </FilterPanel>
        );
        setSidebarFilters(filterUI);
    } else if (subView === 'comparison') {
        const comparisonFilterUI = ( 
            <FilterPanel title="Comparison Filters" onApplyFilters={() => {}} onResetFilters={resetComparisonFilters} >
                <SelectDropdown label={isSalesView ? "Sales Region" : "Province"} options={comparisonProvinceOptions} value={comparisonGeoFilters.province} onChange={(e) => handleComparisonGeoFilterChange('province', e.target.value)} />
                <SelectDropdown label={isSalesView ? "Sales District" : "District"} options={comparisonDistrictOptions} value={comparisonGeoFilters.district} onChange={(e) => handleComparisonGeoFilterChange('district', e.target.value)} disabled={comparisonGeoFilters.province === 'all' && comparisonDistrictOptions.length <= 1} />
                <SelectDropdown label="DS Division" options={comparisonDsDivisionOptions} value={comparisonGeoFilters.dsDivision} onChange={(e) => handleComparisonGeoFilterChange('dsDivision', e.target.value)} disabled={comparisonGeoFilters.district === 'all' && comparisonDsDivisionOptions.length <= 1}/>
                <SelectDropdown 
                    label="Retailer Name/ID" 
                    options={comparisonRetailerOptions} 
                    value={comparisonRetailerId} 
                    onChange={(e) => setComparisonRetailerId(e.target.value)} 
                    disabled={isLoadingRetailersForComparison || (comparisonGeoFilters.province === 'all' && comparisonGeoFilters.district === 'all' && comparisonGeoFilters.dsDivision === 'all' && comparisonRetailerOptions.length <= 1)} />
                {isLoadingRetailersForComparison && <LoadingSpinner size="sm" message="Loading retailers..." />}
            </FilterPanel>
        );
        setSidebarFilters(comparisonFilterUI);
    } else {
        setSidebarFilters(null);
    }
    return () => { setSidebarFilters(null); };
  }, [
    subView, currentGeneralFilters, viewMode, isSalesView,
    handleGeneralFilterChange, handleVisibilityRangeChange, 
    comparisonGeoFilters, comparisonRetailerId, comparisonRetailerOptions,
    generalRetailerOptions, handleComparisonGeoFilterChange, 
    setSidebarFilters, isLoadingRetailersForComparison, isLoading,
    fetchDataForGeneralSubView, resetGeneralFilters, resetComparisonFilters,
    generalProvinceOptions, generalDistrictOptions, generalDsDivisionOptions,
    comparisonProvinceOptions, comparisonDistrictOptions, comparisonDsDivisionOptions
  ]);

  const handleDownloadPosmCSV = () => {
    if (posmData.length === 0) {
        alert("No POSM data to download.");
        return;
    }
    const csvString = convertToCSV(posmData, columnsForPosmTable);
    downloadCSV(csvString, 'posm_data.csv');
  };

  const renderSubViewContent = () => { 
    if (isLoading && subView !== 'comparison') {
        return <LoadingSpinner message="Loading POSM data..." />;
    }
    if (error && subView !== 'comparison') {
        return <ErrorMessage message={error} />;
    }

    switch (subView) {
      case 'general':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <MetricBox title="Total POSM Entries" value={posmDataCount.toString()} />
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
                            key={metric.provider} label={metric.provider} 
                            percentage={metric.percentage || 0} 
                            color={providerConfig?.color || '#718096'}
                            providerLogoUrl={providerConfig?.logoUrl} />
                    );
                })}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Image</h3>
              {currentGeneralFilters.retailerId !== 'all' && selectedRetailerImageId ? (
                <ImageDisplay imageIdentifier={selectedRetailerImageId} altText={`Image for retailer ${currentGeneralFilters.retailerId}`} className="w-full max-w-md h-auto mx-auto" />
              ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {currentGeneralFilters.retailerId !== 'all' && !selectedRetailerImageId 
                        ? "Image not available for the selected retailer."
                        : "Select a specific retailer to view their image."}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Data Details ({posmDataCount} items)</h3>
                <Button onClick={handleDownloadPosmCSV} variant="outline" size="sm" disabled={posmData.length === 0} aria-label="Download POSM data as CSV" >
                  <DownloadIcon className="w-4 h-4 mr-2"/> Download CSV
                </Button>
              </div>
              <DataTable columns={columnsForPosmTable} data={posmData} />
            </div>
          </>
        );
      case 'district':
        return (
          <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">District POSM Visibility (Choropleth)</h3>
            {isLoading ? <LoadingSpinner message="Loading map data..."/> : 
             geoJsonDistricts ? (<InteractiveMap retailers={[]} geoJsonData={geoJsonDistricts} />) : 
             (<p className="dark:text-gray-300">Map data not available or failed to load.</p>)
            }
             <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Choropleth map showing POSM metrics by district. Colors would be based on data fetched and merged with GeoJSON.</p>
          </div>
        );
      case 'comparison':
        return (
            <PosmComparison 
                retailerOptions={comparisonRetailerOptions} 
                selectedRetailerId={comparisonRetailerId}
                batchOptions={availableBatches} />
        );
      default: return null;
    }
  };
  
  useEffect(() => {
    if (subView !== 'comparison' && error && (error.includes("batch") || error.includes("comparison"))){ setError(null); }
    if (subView === 'comparison' && error && !(error.includes("batch") || error.includes("comparison"))) { setError(null); }
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