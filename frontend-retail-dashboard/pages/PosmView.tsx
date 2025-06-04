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
    IconProps
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
    { Header: 'Visibility %', accessor: 'visibilityPercentage'},
    { Header: 'Province', accessor: (row: PosmData) => row.PROVINCE || row.SALES_REGION }, // Display based on availability
    { Header: 'District', accessor: (row: PosmData) => row.DISTRICT || row.SALES_DISTRICT },
    { Header: 'DS Division', accessor: 'DS_DIVISION' },
    { Header: 'GN Division', accessor: 'GN_DIVISION' },
    // { Header: 'Sales Region', accessor: 'SALES_REGION' }, // Covered by Province/District accessors
    // { Header: 'Sales District', accessor: 'SALES_DISTRICT' },
    { Header: 'Sales Area', accessor: 'SALES_AREA' },
    { Header: 'Dialog %', accessor: 'DIALOG_AREA_PERCENTAGE' },
    { Header: 'Airtel %', accessor: 'AIRTEL_AREA_PERCENTAGE' },
    { Header: 'Mobitel %', accessor: 'MOBITEL_AREA_PERCENTAGE' },
    { Header: 'Hutch %', accessor: 'HUTCH_AREA_PERCENTAGE' },
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

const PosmView: React.FC<PosmViewProps> = ({ viewMode, setSidebarFilters }) => {
  const [subView, setSubView] = useState<PosmSubView>('general');
  const [currentGeneralFilters, setCurrentGeneralFilters] = useState<PosmGeneralFiltersState>(initialPosmViewFilters);

  const [posmData, setPosmData] = useState<PosmData[]>([]);
  const [posmDataCount, setPosmDataCount] = useState<number>(0);
  const [providerPosmMetrics, setProviderPosmMetrics] = useState<ProviderMetric[]>([]);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
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
  const geoLabel = isSalesView ? "Sales Region" : "Province";
  const districtLabel = isSalesView ? "Sales District" : "District";


  const handleGeneralFilterChange = useCallback((filterName: keyof PosmGeneralFiltersState, value: string | [number, number]) => {
    setCurrentGeneralFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'provider') {
            newFilters.province = 'all'; // Reset geo filters
            newFilters.district = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
            newFilters.posmStatus = 'all'; // Reset new POSM status filter
            newFilters.visibilityRange = [0, 100]; // Reset visibility range
        } else if (filterName === 'province' && value !== 'all') {
            newFilters.district = 'all';
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'district' && value !== 'all') {
            newFilters.dsDivision = 'all';
            newFilters.retailerId = 'all';
        } else if (filterName === 'dsDivision' && value !== 'all') {
            newFilters.retailerId = 'all';
        }
        // If posmStatus changes, it might affect visibilityRange's relevance/display (handled in UI)
        return newFilters;
    });
  }, []);

  const handleVisibilityRangeChange = useCallback((values: [number, number]) => {
    handleGeneralFilterChange('visibilityRange', values);
  }, [handleGeneralFilterChange]);

  // Fetching logic for General/District sub-view filters
  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, provinces: true}));
    fetchProvinces(currentGeneralFilters.provider, isSalesView, 'posm').then(options => { // context 'posm'
        setGeneralProvinceOptions([{value: 'all', label: `All ${geoLabel}s`}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, provinces: false})));
  }, [currentGeneralFilters.provider, isSalesView, geoLabel]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, districts: true}));
    const provinceToFilterBy = currentGeneralFilters.province === 'all' ? undefined : currentGeneralFilters.province;
    fetchDistricts(currentGeneralFilters.provider, provinceToFilterBy, isSalesView, 'posm').then(options => { // context 'posm'
        setGeneralDistrictOptions([{value: 'all', label: `All ${districtLabel}s`}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, districts: false})));
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, isSalesView, districtLabel]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, dsDivisions: true}));
    const provinceToFilterBy = currentGeneralFilters.province === 'all' ? undefined : currentGeneralFilters.province;
    const districtToFilterBy = currentGeneralFilters.district === 'all' ? undefined : currentGeneralFilters.district;
    fetchDsDivisions(currentGeneralFilters.provider, provinceToFilterBy, districtToFilterBy, 'posm').then(options => { // context 'posm'
        setGeneralDsDivisionOptions([{value: 'all', label: 'All DS Divisions'}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, dsDivisions: false})));
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, currentGeneralFilters.district]);

  useEffect(() => {
    setIsLoadingOptions(prev => ({...prev, retailers: true}));
    const filtersForRetailerFetch: any = {
        provider: currentGeneralFilters.provider,
        dsDivision: currentGeneralFilters.dsDivision,
    };
    // Geo filters for retailers: use province/district state which aligns with labels
    if (currentGeneralFilters.province !== 'all') filtersForRetailerFetch.province = currentGeneralFilters.province;
    if (currentGeneralFilters.district !== 'all') filtersForRetailerFetch.district = currentGeneralFilters.district;

    fetchRetailers(filtersForRetailerFetch, 'posm').then(data => { // context 'posm'
        const options = data.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }));
        setGeneralRetailerOptions([{value: 'all', label: 'All Retailers'}, ...options]);
    }).finally(() => setIsLoadingOptions(prev => ({...prev, retailers: false})));
  }, [currentGeneralFilters.provider, currentGeneralFilters.province, currentGeneralFilters.district, currentGeneralFilters.dsDivision]);


  const fetchDataForGeneralSubView = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass all filters, including new posmStatus and visibilityRange
      const { data, count, providerMetrics } = await fetchPosmGeneral(currentGeneralFilters);
      setPosmData(data);
      setPosmDataCount(count);
      setProviderPosmMetrics(providerMetrics);

      const retailerLocationFilters: any = {
        provider: currentGeneralFilters.provider,
        province: currentGeneralFilters.province,
        district: currentGeneralFilters.district,
        dsDivision: currentGeneralFilters.dsDivision,
      };
      if (currentGeneralFilters.retailerId !== 'all') {
        retailerLocationFilters.retailerId = currentGeneralFilters.retailerId;
      }

      const retailersForMap = await fetchRetailers(retailerLocationFilters, 'posm');
      setMapRetailers(retailersForMap);
      
      if (currentGeneralFilters.retailerId !== 'all') {
        const selectedRetailerDetails = retailersForMap.find(r => r.id === currentGeneralFilters.retailerId);
        const relevantPosmEntry = data.find(p => p.retailerId === currentGeneralFilters.retailerId);
        setSelectedRetailerImageId(relevantPosmEntry?.originalPosmImageIdentifier || selectedRetailerDetails?.imageIdentifier);
      } else {
        setSelectedRetailerImageId(undefined);
      }

      if (subView === 'district') {
        const geoData = await fetchGeoDistricts();
        setGeoJsonDistricts(geoData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load POSM data.");
      setPosmData([]); setPosmDataCount(0); setProviderPosmMetrics([]); setMapRetailers([]);
    }
    finally { setIsLoading(false); }
  }, [currentGeneralFilters, subView]);

  const resetGeneralFilters = useCallback(() => {
    setCurrentGeneralFilters(initialPosmViewFilters);
    setSelectedRetailerImageId(undefined);
    setPosmData([]); setPosmDataCount(0); setMapRetailers([]); setProviderPosmMetrics([]);
  }, []);

  const handleComparisonGeoFilterChange = useCallback((filterName: keyof typeof initialComparisonGeoFilters, value: string) => {
    setComparisonGeoFilters(prev => {
        const newFilters = {...prev, [filterName]: value};
         if (filterName === 'province') { newFilters.district = 'all'; newFilters.dsDivision = 'all'; }
         else if (filterName === 'district') { newFilters.dsDivision = 'all';}
        setComparisonRetailerId('all');
        return newFilters;
    });
  }, []);
  
  useEffect(() => {
    if (subView === 'comparison') {
      fetchProvinces(undefined, isSalesView, 'posm').then(options => {
          setComparisonProvinceOptions([{ value: 'all', label: `All ${geoLabel}s` }, ...options]);
      });
    }
  }, [subView, isSalesView, geoLabel]);

  useEffect(() => {
    if (subView === 'comparison') {
      const { province } = comparisonGeoFilters;
      const provinceToFilterBy = province === 'all' ? undefined : province;
      fetchDistricts(undefined, provinceToFilterBy, isSalesView, 'posm').then(options => {
          setComparisonDistrictOptions([{ value: 'all', label: `All ${districtLabel}s` }, ...options]);
      });
    }
  }, [comparisonGeoFilters.province, subView, isSalesView, districtLabel]);

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
      const currentCompFiltersForRetailer: any = {};
      if (province !== 'all') currentCompFiltersForRetailer.province = province;
      if (district !== 'all') currentCompFiltersForRetailer.district = district;
      if (dsDivision !== 'all') currentCompFiltersForRetailer.dsDivision = dsDivision;

      fetchRetailers(currentCompFiltersForRetailer, 'posm')
        .then(retailers => {
          const options = [{value: 'all', label: 'All Retailers'}, ...retailers.map(r => ({value: r.id, label: `${r.id} - ${r.name}`}))];
          setComparisonRetailerOptions(options);
          if (comparisonRetailerId !== 'all' && !options.find(opt => opt.value === comparisonRetailerId)) {
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
        .then(setAvailableBatches)
        .catch(err => { setError("Failed to load batches for comparison."); })
        .finally(() => setIsLoading(false));
    } else {
      setAvailableBatches([]);
    }
  }, [comparisonRetailerId, subView]);


  useEffect(() => {
    if (subView === 'general' || subView === 'district') {
        const showProviderSpecificAdvancedFilters = currentGeneralFilters.provider !== 'all';
        const showVisibilitySlider = showProviderSpecificAdvancedFilters && currentGeneralFilters.posmStatus === 'all';

        const filterUI = (
            <FilterPanel
                title={`${subView.charAt(0).toUpperCase() + subView.slice(1)} POSM Filters`}
                onApplyFilters={fetchDataForGeneralSubView}
                onResetFilters={resetGeneralFilters}
            >
                <SelectDropdown label="Provider" options={PROVIDER_FILTER_OPTIONS} value={currentGeneralFilters.provider} onChange={(e) => handleGeneralFilterChange('provider', e.target.value)} disabled={isLoadingOptions['provinces']} />
                
                {showProviderSpecificAdvancedFilters && (
                  <>
                    <SelectDropdown
                        label={DEFAULT_POSM_STATUS_LABEL}
                        options={POSM_STATUSES}
                        value={currentGeneralFilters.posmStatus}
                        onChange={(e) => handleGeneralFilterChange('posmStatus', e.target.value)}
                    />
                    {showVisibilitySlider && (
                        <RangeSlider
                            label={DEFAULT_VISIBILITY_PERCENTAGE_LABEL}
                            min={0} max={100}
                            initialValues={currentGeneralFilters.visibilityRange}
                            onChangeCommitted={handleVisibilityRangeChange}
                        />
                    )}
                  </>
                )}

                <SelectDropdown
                    label={geoLabel}
                    options={generalProvinceOptions}
                    value={currentGeneralFilters.province}
                    onChange={(e) => handleGeneralFilterChange('province', e.target.value)}
                    disabled={isLoadingOptions['provinces'] || isLoadingOptions['districts']}
                />
                <SelectDropdown
                    label={districtLabel}
                    options={generalDistrictOptions}
                    value={currentGeneralFilters.district}
                    onChange={(e) => handleGeneralFilterChange('district', e.target.value)}
                    disabled={isLoadingOptions['districts'] || isLoadingOptions['dsDivisions']}
                />
                <SelectDropdown
                    label="DS Division"
                    options={generalDsDivisionOptions}
                    value={currentGeneralFilters.dsDivision}
                    onChange={(e) => handleGeneralFilterChange('dsDivision', e.target.value)}
                    disabled={isLoadingOptions['dsDivisions'] || isLoadingOptions['retailers']}
                />
                <SelectDropdown
                    label="Retailer Name/ID"
                    options={generalRetailerOptions}
                    value={currentGeneralFilters.retailerId}
                    onChange={(e) => handleGeneralFilterChange('retailerId', e.target.value)}
                    disabled={isLoadingOptions['retailers']}
                />
            </FilterPanel>
        );
        setSidebarFilters(filterUI);
    } else if (subView === 'comparison') {
        // ... Comparison filter UI setup (as before)
         const comparisonFilterUI = (
            <FilterPanel title="Comparison Filters" onApplyFilters={() => {}} onResetFilters={() => {
                setComparisonGeoFilters(initialComparisonGeoFilters);
                setComparisonRetailerId('all');
            }} >
                <SelectDropdown label={geoLabel} options={comparisonProvinceOptions} value={comparisonGeoFilters.province} onChange={(e) => handleComparisonGeoFilterChange('province', e.target.value)} />
                <SelectDropdown label={districtLabel} options={comparisonDistrictOptions} value={comparisonGeoFilters.district} onChange={(e) => handleComparisonGeoFilterChange('district', e.target.value)} disabled={comparisonGeoFilters.province === 'all' && comparisonDistrictOptions.length <= 1} />
                <SelectDropdown label="DS Division" options={comparisonDsDivisionOptions} value={comparisonGeoFilters.dsDivision} onChange={(e) => handleComparisonGeoFilterChange('dsDivision', e.target.value)} disabled={comparisonGeoFilters.district === 'all' && comparisonDsDivisionOptions.length <= 1}/>
                <SelectDropdown
                    label="Retailer Name/ID"
                    options={comparisonRetailerOptions}
                    value={comparisonRetailerId}
                    onChange={(e) => setComparisonRetailerId(e.target.value)}
                    disabled={isLoadingRetailersForComparison} />
                {isLoadingRetailersForComparison && <LoadingSpinner size="sm" message="Loading retailers..." />}
            </FilterPanel>
        );
        setSidebarFilters(comparisonFilterUI);
    } else {
        setSidebarFilters(null);
    }
    return () => { setSidebarFilters(null); };
  }, [
    subView, currentGeneralFilters, viewMode, isSalesView, geoLabel, districtLabel,
    handleGeneralFilterChange, handleVisibilityRangeChange,
    comparisonGeoFilters, comparisonRetailerId, comparisonRetailerOptions,
    generalRetailerOptions, handleComparisonGeoFilterChange,
    setSidebarFilters, isLoadingRetailersForComparison, isLoading, isLoadingOptions,
    fetchDataForGeneralSubView, resetGeneralFilters,
    generalProvinceOptions, generalDistrictOptions, generalDsDivisionOptions,
    comparisonProvinceOptions, comparisonDistrictOptions, comparisonDsDivisionOptions
  ]);

  const handleDownloadPosmCSV = () => {
    if (posmData.length === 0) {
        alert("No POSM data to download."); return;
    }
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <MetricBox title="Filtered POSM Entries" value={posmDataCount.toString()} />
              <MetricBox title="Retailers on Map" value={mapRetailers.length.toString()} />
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer POSM Locations</h3>
              <InteractiveMap retailers={mapRetailers} geoJsonData={null} />
            </div>
            <div className="space-y-4 mb-6 bg-white dark:bg-dark-card p-4 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Provider Average POSM Visibility (Filtered)</h3>
                {providerPosmMetrics.length > 0 ? providerPosmMetrics.map(metric => {
                    const providerConfig = PROVIDERS_CONFIG.find(p => p.name === metric.provider);
                    return (
                        <PercentageBar
                            key={metric.provider} label={metric.provider}
                            percentage={metric.percentage || 0}
                            color={providerConfig?.color || '#718096'}
                            providerLogoUrl={providerConfig?.logoUrl} />
                    );
                }) : <p className="text-gray-500 dark:text-gray-400">No provider metrics based on current filters.</p>}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Image (POSM Context)</h3>
              {currentGeneralFilters.retailerId !== 'all' && selectedRetailerImageId ? (
                <ImageDisplay imageIdentifier={selectedRetailerImageId} altText={`POSM related image for retailer ${currentGeneralFilters.retailerId}`} className="w-full max-w-md h-auto mx-auto" />
              ) : (
                 <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    {currentGeneralFilters.retailerId === 'all'
                        ? "Select a specific retailer to view their image."
                        : (isLoadingOptions['retailers'] || isLoading) ? "Loading image..." : "Image not available for the selected retailer in POSM context."}
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
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">District POSM Metrics (Choropleth)</h3>
            {isLoading ? <LoadingSpinner message="Loading map data..."/> :
             geoJsonDistricts ? (<InteractiveMap retailers={[]} geoJsonData={geoJsonDistricts} />) :
             (<p className="dark:text-gray-300">Map data not available or failed to load.</p>)
            }
             <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Choropleth map functionality pending specific backend data aggregation for POSM metrics by district.</p>
          </div>
        );
      case 'comparison':
        return ( <PosmComparison retailerOptions={comparisonRetailerOptions} selectedRetailerId={comparisonRetailerId} batchOptions={availableBatches} />);
      default: return null;
    }
  };

  useEffect(() => {
    if (subView !== 'comparison' && error && (error.includes("batch") || error.includes("comparison"))){ setError(null); }
    if (subView === 'comparison' && error && !(error.includes("batch") || error.includes("comparison"))) { setError(null); }
  }, [subView, error]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">POSM View ({viewMode === 'sales' ? `Sales` : `Admin`})</h2>
      <div className="flex space-x-1 border-b border-gray-300 dark:border-gray-700 mb-4">
        {(['general', 'district', 'comparison'] as PosmSubView[]).map(sv => (
          <button
            key={sv}
            onClick={() => setSubView(sv)}
            className={`px-3 py-2 font-medium text-sm capitalize rounded-t-md focus:outline-none transition-colors flex items-center justify-center
              ${subView === sv ? 'bg-primary text-white dark:bg-secondary' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600'}`}
            aria-current={subView === sv ? "page" : undefined}
          >
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