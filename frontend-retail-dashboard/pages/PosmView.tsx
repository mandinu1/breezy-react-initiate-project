// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-0fa4c536d6929256228f28fa08a2914fae3eabac/frontend-retail-dashboard/pages/PosmView.tsx
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
    IconProps,
    UsersIcon // For total retailer count
} from '../components/shared/Icons';
import {
    PROVIDER_FILTER_OPTIONS,
    POSM_STATUSES,
    PROVIDERS_CONFIG,
} from '../constants';
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

const initialPosmViewFilters: PosmGeneralFiltersState = {
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

const DEFAULT_POSM_STATUS_LABEL = "Provider Status";
const DEFAULT_VISIBILITY_PERCENTAGE_LABEL = "Provider Visibility %";

const subViewIcons: Record<PosmSubView, React.ReactElement<IconProps>> = {
    general: <InformationCircleIcon />,
    district: <MapIcon />,
    comparison: <ArrowsRightLeftIcon />,
};

const columnsForPosmTable = [
    { Header: 'POSM ID', accessor: 'id' },
    { Header: 'Retailer ID', accessor: 'retailerId' },
    { Header: 'Profile Name', accessor: 'PROFILE_NAME'},
    { Header: 'Main Provider', accessor: 'provider'},
    { Header: 'Visibility %', accessor: (row: PosmData) => row.visibilityPercentage?.toFixed(1) },
    { Header: 'Province', accessor: (row: PosmData) => row.PROVINCE || row.SALES_REGION },
    { Header: 'District', accessor: (row: PosmData) => row.DISTRICT || row.SALES_DISTRICT },
    { Header: 'DS Division', accessor: 'DS_DIVISION' },
    { Header: 'Sales Area', accessor: 'SALES_AREA' },
    { Header: 'Dialog %', accessor: (row: PosmData) => row.DIALOG_AREA_PERCENTAGE?.toFixed(1) },
    { Header: 'Airtel %', accessor: (row: PosmData) => row.AIRTEL_AREA_PERCENTAGE?.toFixed(1) },
    { Header: 'Mobitel %', accessor: (row: PosmData) => row.MOBITEL_AREA_PERCENTAGE?.toFixed(1) },
    { Header: 'Hutch %', accessor: (row: PosmData) => row.HUTCH_AREA_PERCENTAGE?.toFixed(1) },
  ];

const convertToCSV = (data: any[], columns: { Header: string, accessor: string | ((row: any) => any) }[]): string => {
    const header = columns.map(col => `"${col.Header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            let cellData;
            if (typeof col.accessor === 'function') {
                cellData = col.accessor(row);
            } else {
                cellData = row[col.accessor];
            }
            if (cellData === undefined || cellData === null) cellData = '';
            else if (typeof cellData === 'number') cellData = cellData.toString(); // Functions might return number
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

const PosmView: React.FC<PosmViewProps> = ({ viewMode, setSidebarFilters }) => {
  const [subView, setSubView] = useState<PosmSubView>('general');
  const [currentGeneralFilters, setCurrentGeneralFilters] = useState<PosmGeneralFiltersState>(initialPosmViewFilters);

  const [posmData, setPosmData] = useState<PosmData[]>([]);
  const [posmDataCount, setPosmDataCount] = useState<number>(0);
  const [providerPosmMetrics, setProviderPosmMetrics] = useState<ProviderMetric[]>([]);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [totalSystemRetailers, setTotalSystemRetailers] = useState<number | null>(null);
  const [geoJsonDistricts, setGeoJsonDistricts] = useState<GeoJsonCollection | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [generalProvinceOptions, setGeneralProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Provinces/Regions' }]);
  const [generalDistrictOptions, setGeneralDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [generalDsDivisionOptions, setGeneralDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [generalRetailerOptions, setGeneralRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);

  const [isLoadingRetailersForComparison, setIsLoadingRetailersForComparison] = useState<boolean>(false);
  const [availableBatches, setAvailableBatches] = useState<FilterOption[]>([]);
  const [comparisonGeoFilters, setComparisonGeoFilters] = useState(initialComparisonGeoFilters);
  const [comparisonProvinceOptions, setComparisonProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Provinces/Regions' }]);
  const [comparisonDistrictOptions, setComparisonDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [comparisonDsDivisionOptions, setComparisonDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [comparisonRetailerOptions, setComparisonRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);
  const [comparisonRetailerId, setComparisonRetailerId] = useState<string>('all');

  const [selectedRetailerImageId, setSelectedRetailerImageId] = useState<string | undefined>(undefined);
  const isSalesView = viewMode === 'sales';
  // Determine labels based on viewMode for geo filters
  const provinceLabelForFilter = isSalesView ? "Sales Region" : "Province";
  const districtLabelForFilter = isSalesView ? "Sales District" : "District";

  const fetchTotalRetailerCountForPosm = useCallback(async () => {
    try {
        const allRetailers = await fetchRetailers({}, 'posm'); // Fetch all for posm context
        setTotalSystemRetailers(allRetailers.length);
    } catch (e) {
        console.error("Failed to fetch total POSM retailer count", e);
        setTotalSystemRetailers(0);
    }
  }, []);

  useEffect(() => {
    fetchTotalRetailerCountForPosm();
  }, [fetchTotalRetailerCountForPosm]);


  const handleGeneralFilterChange = useCallback((filterName: keyof PosmGeneralFiltersState, value: string | [number, number]) => {
    setCurrentGeneralFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'provider') {
            newFilters.province = 'all'; newFilters.district = 'all'; newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
            newFilters.posmStatus = 'all'; newFilters.visibilityRange = [0, 100];
        } else if (filterName === 'province' && value !== 'all') {
            newFilters.district = 'all'; newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'district' && value !== 'all') {
            newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
        } else if (filterName === 'dsDivision' && value !== 'all') {
            newFilters.retailerId = 'all';
        }
        return newFilters;
    });
  }, []);

  const handleVisibilityRangeChange = useCallback((values: [number, number]) => {
    handleGeneralFilterChange('visibilityRange', values);
  }, [handleGeneralFilterChange]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, provinces: true}));
    fetchProvinces(currentGeneralFilters.provider, isSalesView, 'posm').then(options => {
        setGeneralProvinceOptions([{value: 'all', label: `All ${provinceLabelForFilter}s`}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, provinces: false})));
  }, [currentGeneralFilters.provider, isSalesView, provinceLabelForFilter]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, districts: true}));
    const provinceToFilterBy = currentGeneralFilters.province === 'all' ? undefined : currentGeneralFilters.province;
    fetchDistricts(currentGeneralFilters.provider, provinceToFilterBy, isSalesView, 'posm').then(options => {
        setGeneralDistrictOptions([{value: 'all', label: `All ${districtLabelForFilter}s`}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, districts: false})));
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, isSalesView, districtLabelForFilter]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, dsDivisions: true}));
    const provinceToFilterBy = currentGeneralFilters.province === 'all' ? undefined : currentGeneralFilters.province;
    const districtToFilterBy = currentGeneralFilters.district === 'all' ? undefined : currentGeneralFilters.district;
    fetchDsDivisions(currentGeneralFilters.provider, provinceToFilterBy, districtToFilterBy, 'posm').then(options => {
        setGeneralDsDivisionOptions([{value: 'all', label: 'All DS Divisions'}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, dsDivisions: false})));
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, currentGeneralFilters.district]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, retailers: true}));
    const filtersForRetailerFetch: any = { provider: currentGeneralFilters.provider };
    if (currentGeneralFilters.province !== 'all') filtersForRetailerFetch.province = currentGeneralFilters.province; // Use 'province' state which holds current geo selection
    if (currentGeneralFilters.district !== 'all') filtersForRetailerFetch.district = currentGeneralFilters.district;
    if (currentGeneralFilters.dsDivision !== 'all') filtersForRetailerFetch.dsDivision = currentGeneralFilters.dsDivision;
    
    fetchRetailers(filtersForRetailerFetch, 'posm').then(data => {
        const options = data.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }));
        setGeneralRetailerOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, retailers: false})));
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, currentGeneralFilters.district, currentGeneralFilters.dsDivision]);

  const fetchDataForGeneralSubView = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const { data, count, providerMetrics: fetchedProviderMetrics } = await fetchPosmGeneral(currentGeneralFilters);
      setPosmData(data); setPosmDataCount(count); setProviderPosmMetrics(fetchedProviderMetrics);

      const retailerApiFilters: any = {
          provider: currentGeneralFilters.provider,
          province: currentGeneralFilters.province, district: currentGeneralFilters.district,
          dsDivision: currentGeneralFilters.dsDivision,
      };
      if (currentGeneralFilters.retailerId !== 'all') { retailerApiFilters.retailerId = currentGeneralFilters.retailerId; }

      const retailersForMapData = await fetchRetailers(retailerApiFilters, 'posm');
      setMapRetailers(retailersForMapData);
      
      if (currentGeneralFilters.retailerId !== 'all') {
        const selectedRetailerDetails = retailersForMapData.find(r => r.id === currentGeneralFilters.retailerId);
        const relevantPosmEntry = data.find(p => p.retailerId === currentGeneralFilters.retailerId);
        setSelectedRetailerImageId(relevantPosmEntry?.originalPosmImageIdentifier || selectedRetailerDetails?.imageIdentifier);
      } else {
        setSelectedRetailerImageId(undefined);
      }
      if (subView === 'district') {
        const geoData = await fetchGeoDistricts(); setGeoJsonDistricts(geoData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load POSM data.");
      setPosmData([]); setPosmDataCount(0); setProviderPosmMetrics([]); setMapRetailers([]);
    } finally { setIsLoading(false); }
  }, [currentGeneralFilters, subView]);
  
  // Initial data load for the current sub-view
  useEffect(() => {
    if (subView === 'general' || subView === 'district') {
        fetchDataForGeneralSubView();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subView]); // Rerun if subView changes to general/district. Initial call on mount will use default subView.


  const resetGeneralFilters = useCallback(() => {
    setCurrentGeneralFilters(initialPosmViewFilters);
    // Trigger data fetch with reset filters
    fetchDataForGeneralSubView(); // This will now use initialPosmViewFilters
  }, [fetchDataForGeneralSubView]);


  // --- Comparison View Logic (largely unchanged, ensure context for API calls) ---
  const handleComparisonGeoFilterChange = useCallback((filterName: keyof typeof initialComparisonGeoFilters, value: string) => {
    setComparisonGeoFilters(prev => {
        const newFilters = {...prev, [filterName]: value};
         if (filterName === 'province') { newFilters.district = 'all'; newFilters.dsDivision = 'all'; }
         else if (filterName === 'district') { newFilters.dsDivision = 'all';}
        setComparisonRetailerId('all'); return newFilters;
    });
  }, []);
  
  useEffect(() => { // For comparison geo dropdowns
    if (subView === 'comparison') {
      fetchProvinces(undefined, isSalesView, 'posm').then(options => {
          setComparisonProvinceOptions([{ value: 'all', label: `All ${provinceLabelForFilter}s` }, ...options]);
      });
      // Reset main view data if switching away from general/district
    } else if (subView !== 'general' && subView !== 'district') {
        setPosmData([]); setPosmDataCount(0); setProviderPosmMetrics([]); setMapRetailers([]);
    }
  }, [subView, isSalesView, provinceLabelForFilter]);

  useEffect(() => {
    if (subView === 'comparison') {
      const { province } = comparisonGeoFilters;
      const provinceToFilterBy = province === 'all' ? undefined : province;
      fetchDistricts(undefined, provinceToFilterBy, isSalesView, 'posm').then(options => {
          setComparisonDistrictOptions([{ value: 'all', label: `All ${districtLabelForFilter}s` }, ...options]);
      });
    }
  }, [comparisonGeoFilters.province, subView, isSalesView, districtLabelForFilter]);

   useEffect(() => {
    if (subView === 'comparison') {
      const { province, district } = comparisonGeoFilters;
      const provinceToFilterBy = province === 'all' ? undefined : province;
      const districtToFilterBy = district === 'all' ? undefined : district;
      fetchDsDivisions(undefined, provinceToFilterBy, districtToFilterBy, 'posm').then(options => {
          setComparisonDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }, ...options]);
      });
    }
  }, [comparisonGeoFilters.province, comparisonGeoFilters.district, subView]);
  
  useEffect(() => {
    if (subView === 'comparison') {
      setIsLoadingRetailersForComparison(true);
      const { province, district, dsDivision } = comparisonGeoFilters;
      const compGeoFilters: any = {};
      if (province !== 'all') compGeoFilters.province = province;
      if (district !== 'all') compGeoFilters.district = district;
      if (dsDivision !== 'all') compGeoFilters.dsDivision = dsDivision;

      fetchRetailers(compGeoFilters, 'posm')
        .then(retailers => {
          const opts = [{value: 'all', label: 'All Retailers'}, ...retailers.map(r => ({value: r.id, label: `${r.id} - ${r.name}`}))];
          setComparisonRetailerOptions(opts);
          if (comparisonRetailerId !== 'all' && !opts.find(opt => opt.value === comparisonRetailerId)) {
            setComparisonRetailerId('all'); setAvailableBatches([]);
          }
        })
        .catch(err => { setError("Failed to load retailers for comparison.");})
        .finally(() => setIsLoadingRetailersForComparison(false));
    }
  }, [comparisonGeoFilters, subView, comparisonRetailerId]);

  useEffect(() => {
    if (subView === 'comparison' && comparisonRetailerId && comparisonRetailerId !== 'all') {
      setIsLoading(true);
      fetchAvailableBatches(comparisonRetailerId)
        .then(setAvailableBatches).catch(err => { setError("Failed to load batches for comparison."); })
        .finally(() => setIsLoading(false));
    } else { setAvailableBatches([]); }
  }, [comparisonRetailerId, subView]);


  useEffect(() => {
    if (subView === 'general' || subView === 'district') {
        const showProviderSpecificAdvancedFilters = currentGeneralFilters.provider !== 'all';
        const showVisibilitySlider = showProviderSpecificAdvancedFilters && currentGeneralFilters.posmStatus === 'all';

        const filterUI = (
            <FilterPanel title="POSM Filters" onApplyFilters={fetchDataForGeneralSubView} onResetFilters={resetGeneralFilters}>
                <SelectDropdown label="Provider" options={PROVIDER_FILTER_OPTIONS} value={currentGeneralFilters.provider} onChange={(e) => handleGeneralFilterChange('provider', e.target.value)} disabled={isLoadingOptions['provinces']} />
                {showProviderSpecificAdvancedFilters && (
                  <>
                    <SelectDropdown label={DEFAULT_POSM_STATUS_LABEL} options={POSM_STATUSES} value={currentGeneralFilters.posmStatus} onChange={(e) => handleGeneralFilterChange('posmStatus', e.target.value)} />
                    {showVisibilitySlider && ( <RangeSlider label={DEFAULT_VISIBILITY_PERCENTAGE_LABEL} min={0} max={100} initialValues={currentGeneralFilters.visibilityRange} onChangeCommitted={handleVisibilityRangeChange} /> )}
                  </>
                )}
                <SelectDropdown label={provinceLabelForFilter} options={generalProvinceOptions} value={currentGeneralFilters.province} onChange={(e) => handleGeneralFilterChange('province', e.target.value)} disabled={isLoadingOptions['provinces'] || isLoadingOptions['districts']} />
                <SelectDropdown label={districtLabelForFilter} options={generalDistrictOptions} value={currentGeneralFilters.district} onChange={(e) => handleGeneralFilterChange('district', e.target.value)} disabled={isLoadingOptions['districts'] || isLoadingOptions['dsDivisions']} />
                <SelectDropdown label="DS Division" options={generalDsDivisionOptions} value={currentGeneralFilters.dsDivision} onChange={(e) => handleGeneralFilterChange('dsDivision', e.target.value)} disabled={isLoadingOptions['dsDivisions'] || isLoadingOptions['retailers']} />
                <SelectDropdown label="Retailer Name/ID" options={generalRetailerOptions} value={currentGeneralFilters.retailerId} onChange={(e) => handleGeneralFilterChange('retailerId', e.target.value)} disabled={isLoadingOptions['retailers']} />
            </FilterPanel>
        );
        setSidebarFilters(filterUI);
    } else if (subView === 'comparison') {
        const comparisonFilterUI = (
            <FilterPanel title="Comparison Filters" onApplyFilters={() => {}} onResetFilters={() => { setComparisonGeoFilters(initialComparisonGeoFilters); setComparisonRetailerId('all'); }}>
                <SelectDropdown label={provinceLabelForFilter} options={comparisonProvinceOptions} value={comparisonGeoFilters.province} onChange={(e) => handleComparisonGeoFilterChange('province', e.target.value)} />
                <SelectDropdown label={districtLabelForFilter} options={comparisonDistrictOptions} value={comparisonGeoFilters.district} onChange={(e) => handleComparisonGeoFilterChange('district', e.target.value)} disabled={comparisonGeoFilters.province === 'all' && comparisonDistrictOptions.length <= 1} />
                <SelectDropdown label="DS Division" options={comparisonDsDivisionOptions} value={comparisonGeoFilters.dsDivision} onChange={(e) => handleComparisonGeoFilterChange('dsDivision', e.target.value)} disabled={comparisonGeoFilters.district === 'all' && comparisonDsDivisionOptions.length <= 1}/>
                <SelectDropdown label="Retailer Name/ID" options={comparisonRetailerOptions} value={comparisonRetailerId} onChange={(e) => setComparisonRetailerId(e.target.value)} disabled={isLoadingRetailersForComparison} />
                {isLoadingRetailersForComparison && <LoadingSpinner size="sm" message="Loading retailers..." />}
            </FilterPanel>
        );
        setSidebarFilters(comparisonFilterUI);
    } else {
        setSidebarFilters(null);
    }
    return () => { setSidebarFilters(null); };
  }, [
    subView, currentGeneralFilters, viewMode, isSalesView, provinceLabelForFilter, districtLabelForFilter,
    handleGeneralFilterChange, handleVisibilityRangeChange, comparisonGeoFilters, comparisonRetailerId, 
    comparisonRetailerOptions, generalRetailerOptions, handleComparisonGeoFilterChange, setSidebarFilters, 
    isLoadingRetailersForComparison, isLoading, isLoadingOptions, fetchDataForGeneralSubView, resetGeneralFilters,
    generalProvinceOptions, generalDistrictOptions, generalDsDivisionOptions,
    comparisonProvinceOptions, comparisonDistrictOptions, comparisonDsDivisionOptions
  ]);

  const handleDownloadPosmCSV = () => {
    if (posmData.length === 0) { alert("No POSM data to download."); return; }
    const csvString = convertToCSV(posmData, columnsForPosmTable);
    downloadCSV(csvString, 'posm_data.csv');
  };

  const renderSubViewContent = () => {
    if (isLoading && subView !== 'comparison') { return <LoadingSpinner message="Loading POSM data..." />; }
    if (error && subView !== 'comparison') { return <ErrorMessage message={error} />; }

    switch (subView) {
      case 'general':
        return (
          <>
            {totalSystemRetailers !== null && (
              <div className="mb-6">
                <MetricBox
                    title="Total Unique Retailers (System-wide for POSM)"
                    value={totalSystemRetailers.toString()}
                    icon={<UsersIcon />}
                    className="text-center bg-green-50 dark:bg-green-900 border-green-500"
                    accentColor={PROVIDERS_CONFIG.find(p=>p.key==='all')?.color || '#3B82F6'}
                />
              </div>
            )}
             <div className="mb-6 p-4 bg-white dark:bg-dark-card rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Provider Average POSM Visibility (Filtered: {posmDataCount} entries)</h3>
                {providerPosmMetrics.length > 0 ? providerPosmMetrics.map(metric => {
                    const providerConfig = PROVIDERS_CONFIG.find(p => p.name === metric.provider);
                    return ( <PercentageBar key={metric.provider} label={metric.provider} percentage={metric.percentage || 0} color={providerConfig?.color || '#718096'} providerLogoUrl={providerConfig?.logoUrl} /> );
                }) : <p className="text-gray-500 dark:text-gray-400">No provider metrics based on current filters.</p>}
            </div>

            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer POSM Locations (Filtered Map: {mapRetailers.length})</h3>
              <InteractiveMap retailers={mapRetailers} geoJsonData={null} />
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Image (POSM Context)</h3>
              {currentGeneralFilters.retailerId !== 'all' && selectedRetailerImageId ? (
                <ImageDisplay imageIdentifier={selectedRetailerImageId} altText={`POSM related image for retailer ${currentGeneralFilters.retailerId}`} className="w-full max-w-md h-auto mx-auto" />
              ) : ( <p className="text-gray-500 dark:text-gray-400 text-center py-4"> {currentGeneralFilters.retailerId === 'all' ? "Select a retailer." : "No image."} </p> )}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Data Details ({posmDataCount} items)</h3>
                <Button onClick={handleDownloadPosmCSV} variant="outline" size="sm" disabled={posmData.length === 0} aria-label="Download POSM data as CSV" > <DownloadIcon className="w-4 h-4 mr-2"/> Download CSV </Button>
              </div>
              <DataTable columns={columnsForPosmTable} data={posmData} />
            </div>
          </>
        );
      case 'district': /* ... district view content ... */ return <div className="text-center p-5">District View for POSM - (Choropleth map functionality pending specific backend GeoJSON data for POSM metrics)</div>;
      case 'comparison': return ( <PosmComparison retailerOptions={comparisonRetailerOptions} selectedRetailerId={comparisonRetailerId} batchOptions={availableBatches} />);
      default: return null;
    }
  };
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">POSM View ({viewMode === 'sales' ? `Sales` : `Admin`})</h2>
      <div className="flex space-x-1 border-b border-gray-300 dark:border-gray-700 mb-4">
        {(['general', 'district', 'comparison'] as PosmSubView[]).map(sv => (
          <button key={sv} onClick={() => setSubView(sv)}
            className={`px-3 py-2 font-medium text-sm capitalize rounded-t-md focus:outline-none transition-colors flex items-center justify-center ${subView === sv ? 'bg-primary text-white dark:bg-secondary' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600'}`}
            aria-current={subView === sv ? "page" : undefined} >
            {React.cloneElement(subViewIcons[sv], { className: `w-4 h-4 mr-2 ${subView === sv ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`})}
            {`${sv.charAt(0).toUpperCase() + sv.slice(1)} View`}
          </button>
        ))}
      </div>
      {renderSubViewContent()}
    </div>
  );
};

export default PosmView;