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
import DualImageDisplay from '../components/image/ImageDisplay';
import RangeSlider from '../components/shared/RangeSlider';
import Button from '../components/shared/Button';
import {
    InformationCircleIcon,
    MapIcon,
    ArrowsRightLeftIcon,
    DownloadIcon,
    IconProps,
    UsersIcon,
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

const subViewIcons: Record<PosmSubView, React.ReactElement<IconProps>> = {
    general: <InformationCircleIcon />,
    district: <MapIcon />,
    comparison: <ArrowsRightLeftIcon />,
};

const columnsForPosmTable = [
    { Header: 'IMAGE_REF_ID', accessor: 'id' },
    { Header: 'PROFILE_ID', accessor: 'retailerId' },
    { Header: 'PROFILE_NAME', accessor: 'PROFILE_NAME' },
    { Header: 'PROVINCE', accessor: 'PROVINCE' },
    { Header: 'DISTRICT', accessor: 'DISTRICT' },
    { Header: 'Sales Dist.', accessor: 'SALES_DISTRICT' },
    { Header: 'DS_DIVISION', accessor: 'DS_DIVISION' },
    { Header: 'SALES_AREA', accessor: 'SALES_AREA' },
    { Header: 'DIALOG_AREA_PERCENTAGE', accessor: (row: PosmData) => row.DIALOG_AREA_PERCENTAGE?.toFixed(1) },
    { Header: 'AIRTEL_AREA_PERCENTAGE', accessor: (row: PosmData) => row.AIRTEL_AREA_PERCENTAGE?.toFixed(1) },
    { Header: 'MOBITEL_AREA_PERCENTAGE', accessor: (row: PosmData) => row.MOBITEL_AREA_PERCENTAGE?.toFixed(1) },
    { Header: 'HUTCH_AREA_PERCENTAGE', accessor: (row: PosmData) => row.HUTCH_AREA_PERCENTAGE?.toFixed(1) },
];

const convertToCSV = (data: any[], columns: typeof columnsForPosmTable): string => {
    const header = columns.map(col => `"${col.Header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            let cellData = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor as keyof PosmData];
            if (cellData === undefined || cellData === null) cellData = '';
            return `"${String(cellData).replace(/"/g, '""')}"`;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const PosmView: React.FC<PosmViewProps> = ({ viewMode, setSidebarFilters }) => {
  const [subView, setSubView] = useState<PosmSubView>('general');
  const [activeFilters, setActiveFilters] = useState<PosmGeneralFiltersState>(initialPosmViewFilters);
  const [pendingFilters, setPendingFilters] = useState<PosmGeneralFiltersState>(initialPosmViewFilters);

  const [posmData, setPosmData] = useState<PosmData[]>([]);
  const [posmDataCount, setPosmDataCount] = useState<number>(0);
  const [providerPosmMetrics, setProviderPosmMetrics] = useState<ProviderMetric[]>([]);
  const [mapRetailers, setMapRetailers] = useState<Retailer[]>([]);
  const [totalSystemRetailers, setTotalSystemRetailers] = useState<number | null>(null);
  const [geoJsonDistricts, setGeoJsonDistricts] = useState<GeoJsonCollection | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [generalProvinceOptions, setGeneralProvinceOptions] = useState<FilterOption[]>([{ value: 'all', label: 'Loading...' }]);
  const [generalDistrictOptions, setGeneralDistrictOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Districts' }]);
  const [generalDsDivisionOptions, setGeneralDsDivisionOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All DS Divisions' }]);
  const [generalRetailerOptions, setGeneralRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);

  const [selectedOriginalImageId, setSelectedOriginalImageId] = useState<string | undefined>(undefined);
  const [selectedDetectedImageId, setSelectedDetectedImageId] = useState<string | undefined>(undefined);
  
  const isSalesView = viewMode === 'sales';
  const provinceLabelForFilter = isSalesView ? "Sales Region" : "Province";
  const districtLabelForFilter = isSalesView ? "Sales District" : "District";
  
  // State for comparison view
  const [comparisonRetailerId, setComparisonRetailerId] = useState<string>('all');
  const [comparisonRetailerOptions, setComparisonRetailerOptions] = useState<FilterOption[]>([{ value: 'all', label: 'All Retailers' }]);
  const [availableBatches, setAvailableBatches] = useState<FilterOption[]>([]);


  const fetchData = useCallback(async (filters: PosmGeneralFiltersState) => {
    setIsLoading(true);
    setError(null);
    try {
        if(subView === 'district') {
            const geoData = await fetchGeoDistricts();
            setGeoJsonDistricts(geoData);
        } else {
            const { data, count, providerMetrics } = await fetchPosmGeneral(filters);
            setPosmData(data);
            setPosmDataCount(count);
            setProviderPosmMetrics(providerMetrics);

            const retailersForMap = await fetchRetailers({
                provider: filters.provider,
                dsDivision: filters.dsDivision,
                ...(isSalesView ? { salesRegion: filters.province, salesDistrict: filters.district } : { province: filters.province, district: filters.district }),
                ...(filters.retailerId !== 'all' && { retailerId: filters.retailerId })
            }, 'posm');
            setMapRetailers(retailersForMap);
            
            if (filters.retailerId && filters.retailerId !== 'all') {
                const entry = data.find(p => p.retailerId === filters.retailerId);
                setSelectedOriginalImageId(entry?.originalPosmImageIdentifier);
                setSelectedDetectedImageId(entry?.detectedPosmImageIdentifier);
            } else {
                setSelectedOriginalImageId(undefined);
                setSelectedDetectedImageId(undefined);
            }
        }
    } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
    } finally {
        setIsLoading(false);
    }
  }, [isSalesView, subView]);

  const fetchTotalRetailerCountForPosm = useCallback(async () => {
    try {
        const allRetailers = await fetchRetailers({}, 'posm');
        setTotalSystemRetailers(allRetailers.length);
    } catch (e) {
        setTotalSystemRetailers(0);
    }
  }, []);

  useEffect(() => {
    fetchData(initialPosmViewFilters);
    fetchTotalRetailerCountForPosm();
  }, [fetchData, fetchTotalRetailerCountForPosm]);

  const handleApplyFilters = useCallback(() => {
    setActiveFilters(pendingFilters);
    fetchData(pendingFilters);
  }, [pendingFilters, fetchData]);

  const handleResetFilters = useCallback(() => {
    setPendingFilters(initialPosmViewFilters);
    setActiveFilters(initialPosmViewFilters);
    fetchData(initialPosmViewFilters);
  }, [fetchData]);

  const handlePendingFilterChange = useCallback((filterName: keyof PosmGeneralFiltersState, value: any) => {
    setPendingFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'provider') {
            newFilters.province = 'all'; newFilters.district = 'all';
            newFilters.dsDivision = 'all'; newFilters.retailerId = 'all';
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

  useEffect(() => {
      const { provider, province, district, dsDivision } = pendingFilters;
      const commonParams = { provider, salesView: isSalesView, context: 'posm' };
      
      setIsLoadingOptions(p => ({ ...p, provinces: true }));
      fetchProvinces(commonParams.provider, commonParams.salesView, commonParams.context).then(options => setGeneralProvinceOptions([{ value: 'all', label: `All ${provinceLabelForFilter}s` }, ...options])).finally(() => setIsLoadingOptions(p => ({ ...p, provinces: false })));
      
      setIsLoadingOptions(p => ({ ...p, districts: true }));
      fetchDistricts(commonParams.provider, province === 'all' ? undefined : province, commonParams.salesView, commonParams.context).then(options => setGeneralDistrictOptions([{ value: 'all', label: `All ${districtLabelForFilter}s` }, ...options])).finally(() => setIsLoadingOptions(p => ({ ...p, districts: false })));
      
      setIsLoadingOptions(p => ({ ...p, dsDivisions: true }));
      fetchDsDivisions(commonParams.provider, province === 'all' ? undefined : province, district === 'all' ? undefined : district, commonParams.context).then(options => setGeneralDsDivisionOptions([{ value: 'all', label: 'All DS Divisions' }, ...options])).finally(() => setIsLoadingOptions(p => ({ ...p, dsDivisions: false })));
     
      setIsLoadingOptions(p => ({ ...p, retailers: true }));
      fetchRetailers({ provider, province: province === 'all' ? undefined : province, district: district === 'all' ? undefined : district, dsDivision: dsDivision === 'all' ? undefined : dsDivision }, 'posm').then(data => setGeneralRetailerOptions([{ value: 'all', label: 'All Retailers' }, ...data.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }))])).finally(() => setIsLoadingOptions(p => ({ ...p, retailers: false })));
      
      // For comparison view retailer list
      fetchRetailers({}, 'posm').then(data => setComparisonRetailerOptions([{ value: 'all', label: 'All Retailers' }, ...data.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }))]));

    }, [pendingFilters, isSalesView, provinceLabelForFilter, districtLabelForFilter]);
    
    // Fetch batches when comparison retailer changes
    useEffect(() => {
        if (subView === 'comparison' && comparisonRetailerId && comparisonRetailerId !== 'all') {
            fetchAvailableBatches(comparisonRetailerId).then(setAvailableBatches);
        } else {
            setAvailableBatches([]);
        }
    }, [subView, comparisonRetailerId]);

  useEffect(() => {
    if (subView === 'general') {
        setSidebarFilters(
            <FilterPanel title="POSM Filters" onApplyFilters={handleApplyFilters} onResetFilters={handleResetFilters}>
                <SelectDropdown label="Provider" options={PROVIDER_FILTER_OPTIONS} value={pendingFilters.provider} onChange={(e) => handlePendingFilterChange('provider', e.target.value)} disabled={isLoadingOptions.provinces} />
                {pendingFilters.provider !== 'all' && (
                  <>
                    <SelectDropdown label="Provider Status" options={POSM_STATUSES} value={pendingFilters.posmStatus} onChange={(e) => handlePendingFilterChange('posmStatus', e.target.value)} />
                    {pendingFilters.posmStatus === 'all' && ( <RangeSlider label="Provider Visibility %" min={0} max={100} initialValues={pendingFilters.visibilityRange} onChangeCommitted={(v) => handlePendingFilterChange('visibilityRange', v)} /> )}
                  </>
                )}
                <SelectDropdown label={provinceLabelForFilter} options={generalProvinceOptions} value={pendingFilters.province} onChange={(e) => handlePendingFilterChange('province', e.target.value)} disabled={isLoadingOptions.provinces} />
                <SelectDropdown label={districtLabelForFilter} options={generalDistrictOptions} value={pendingFilters.district} onChange={(e) => handlePendingFilterChange('district', e.target.value)} disabled={isLoadingOptions.districts} />
                <SelectDropdown label="DS Division" options={generalDsDivisionOptions} value={pendingFilters.dsDivision} onChange={(e) => handlePendingFilterChange('dsDivision', e.target.value)} disabled={isLoadingOptions.dsDivisions} />
                <SelectDropdown label="Retailer Name/ID" options={generalRetailerOptions} value={pendingFilters.retailerId} onChange={(e) => handlePendingFilterChange('retailerId', e.target.value)} disabled={isLoadingOptions.retailers} />
            </FilterPanel>
        );
    } else if (subView === 'comparison') {
        setSidebarFilters(
            <FilterPanel title="Comparison Filters" onApplyFilters={() => {}} onResetFilters={() => setComparisonRetailerId('all')}>
                <SelectDropdown label="Retailer Name/ID" options={comparisonRetailerOptions} value={comparisonRetailerId} onChange={(e) => setComparisonRetailerId(e.target.value)} />
            </FilterPanel>
        );
    } else {
      setSidebarFilters(null);
    }
    return () => setSidebarFilters(null);
  }, [subView, pendingFilters, handleApplyFilters, handleResetFilters, handlePendingFilterChange, generalProvinceOptions, generalDistrictOptions, generalDsDivisionOptions, generalRetailerOptions, isLoadingOptions, provinceLabelForFilter, districtLabelForFilter, comparisonRetailerId, comparisonRetailerOptions]);

  const renderSubViewContent = () => {
    if (isLoading) return <LoadingSpinner message="Loading POSM data..." />;
    if (error) return <ErrorMessage message={error} />;

    switch (subView) {
      case 'general':
        return (
          <>
            {totalSystemRetailers !== null && (
                <div className="mb-6">
                    <MetricBox title="Total Retailers with POSM" value={totalSystemRetailers.toString()} icon={<UsersIcon />} className="border-green-500"/>
                </div>
            )}
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Locations</h3>
              <InteractiveMap retailers={mapRetailers} />
            </div>
            <div className="mb-6 p-4 bg-white dark:bg-dark-card rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Provider POSM Visibility</h3>
                {providerPosmMetrics.length > 0 ? providerPosmMetrics.map(metric => {
                    const providerConfig = PROVIDERS_CONFIG.find(p => p.name === metric.provider);
                    return ( <PercentageBar key={metric.provider} label={metric.provider} percentage={metric.percentage || 0} color={providerConfig?.color || '#718096'} providerLogoUrl={providerConfig?.logoUrl} /> );
                }) : <p className="text-gray-500 dark:text-gray-400">No provider visibility data for current filters.</p>}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow mb-6">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Retailer Images</h3>
              {activeFilters.retailerId !== 'all' ? (
                <DualImageDisplay
                    originalImageIdentifier={selectedOriginalImageId}
                    detectedImageIdentifier={selectedDetectedImageId}
                    altTextPrefix={`Retailer ${activeFilters.retailerId}`}
                    defaultImageUrl="/assets/sample-retailer-placeholder.png"
                />
              ) : ( <p className="text-gray-500 dark:text-gray-400 text-center py-4"> 
                    Select a specific retailer and click Apply to view images.
                   </p> 
              )}
            </div>
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Data Details ({posmDataCount} entries)</h3>
                <Button onClick={() => downloadCSV(convertToCSV(posmData, columnsForPosmTable), 'posm_data.csv')} variant="outline" size="sm" disabled={posmData.length === 0} aria-label="Download POSM data as CSV" > <DownloadIcon className="w-4 h-4 mr-2"/> Download CSV </Button>
              </div>
              <DataTable columns={columnsForPosmTable} data={posmData} />
            </div>
          </>
        );
      case 'district': 
        return(
            <div className="bg-white dark:bg-dark-card p-4 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">District POSM Visibility</h3>
                <InteractiveMap retailers={[]} geoJsonData={geoJsonDistricts} />
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
            {React.cloneElement(subViewIcons[sv], { className: `w-4 h-4 mr-2`})}
            {`${sv.charAt(0).toUpperCase() + sv.slice(1)} View`}
          </button>
        ))}
      </div>
      {renderSubViewContent()}
    </div>
  );
};

export default PosmView;