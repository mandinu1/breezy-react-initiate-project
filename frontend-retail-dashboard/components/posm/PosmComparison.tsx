import React, { useState, useEffect, useMemo } from 'react';
import SelectDropdown from '../shared/SelectDropdown';
import PercentageBar from '../metrics/PercentageBar';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorMessage from '../shared/ErrorMessage';
import { FilterOption, PosmComparisonData, PosmBatchDetails } from '../../types';
import { fetchPosmComparisonData } from '../../services/api';
import { PROVIDERS_CONFIG } from '../../constants';
import DualImageDisplay from '../image/ImageDisplay';

interface PosmComparisonProps {
    retailerOptions: FilterOption[];
    selectedRetailerId: string;
    batchOptions: FilterOption[];
}

const PosmComparison: React.FC<PosmComparisonProps> = ({ retailerOptions, selectedRetailerId, batchOptions }) => {
  const [batch1Id, setBatch1Id] = useState<string>('');
  const [batch2Id, setBatch2Id] = useState<string>('');
  
  const [availableBatch1Options, setAvailableBatch1Options] = useState<FilterOption[]>([]);
  const [selectedBatch2Info, setSelectedBatch2Info] = useState<FilterOption | null>(null);

  const [comparisonData, setComparisonData] = useState<PosmComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const actualProviders = useMemo(() => PROVIDERS_CONFIG.filter(p => p.key !== 'all'), []);

  useEffect(() => {
    setError(null);
    setComparisonData(null);

    if (!selectedRetailerId || selectedRetailerId === 'all' || batchOptions.length < 2) {
        setBatch1Id('');
        setBatch2Id('');
        setAvailableBatch1Options([]);
        setSelectedBatch2Info(null);
        return;
    }
    
    const latestBatch = batchOptions[batchOptions.length - 1];
    setBatch2Id(latestBatch.value);
    setSelectedBatch2Info(latestBatch);

    const batch1Opts = batchOptions.filter(b => b.value !== latestBatch.value);
    setAvailableBatch1Options(batch1Opts);

    if (batch1Opts.length > 0) {
        if (!batch1Opts.find(b => b.value === batch1Id)) {
             setBatch1Id(batch1Opts[0].value);
        }
    } else {
        setBatch1Id('');
    }
  }, [selectedRetailerId, batchOptions, batch1Id]);

  const handleCompare = async () => {
    if (!selectedRetailerId || !batch1Id || !batch2Id) {
      setError("Please select a retailer and two different batches.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPosmComparisonData(selectedRetailerId, batch1Id, batch2Id);
      setComparisonData(data);
    } catch (err) {
      setError("Could not load comparison data.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentRetailerLabel = retailerOptions.find(r => r.value === selectedRetailerId)?.label || "Selected Retailer";
  const batch1Label = availableBatch1Options.find(b => b.value === batch1Id)?.label || "Previous";
  const batch2DisplayLabel = selectedBatch2Info?.label || "Latest";

  if (!selectedRetailerId || selectedRetailerId === 'all') {
    return (
        <div className="text-center p-6 bg-white dark:bg-dark-card rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">POSM Comparison</h3>
            <p className="text-gray-500">Please select a retailer from the sidebar to start a comparison.</p>
        </div>
    );
  }
  
  if (batchOptions.length < 2) {
    return (
        <div className="text-center p-6 bg-white dark:bg-dark-card rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">POSM Comparison for {currentRetailerLabel}</h3>
            <p className="text-gray-500">This retailer does not have enough batches for comparison.</p>
        </div>
    );
  }

  const renderBatchDetails = (batchDetails: PosmBatchDetails, title: string) => {
    return (
        <div className="p-4 border rounded-lg dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-800">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center mb-2">{title}</h4>
            <DualImageDisplay originalImageIdentifier={batchDetails.image} altTextPrefix={title} />
            <div className="pt-2 space-y-2">
                {actualProviders.map(providerConfig => {
                    const shareInfo = batchDetails.shares.find(s => s.provider === providerConfig.name);
                    return (
                        <PercentageBar key={providerConfig.key} label={providerConfig.name} percentage={shareInfo?.percentage || 0} color={providerConfig.color} providerLogoUrl={providerConfig.logoUrl}/>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 bg-white dark:bg-dark-card p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Comparison for: <span className="text-primary dark:text-secondary">{currentRetailerLabel}</span></h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <SelectDropdown label="Previous View" options={availableBatch1Options} value={batch1Id} onChange={(e) => setBatch1Id(e.target.value)} />
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current View</label>
            <div className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-gray-100 dark:bg-gray-700 dark:border-gray-600 rounded-md shadow-sm">
                {batch2DisplayLabel}
            </div>
        </div>
      </div>
      <Button onClick={handleCompare} disabled={isLoading || !batch1Id || !batch2Id} className="w-full sm:w-auto">
        {isLoading ? 'Comparing...' : 'Compare Batches'}
      </Button>

      {error && <ErrorMessage title="Comparison Error" message={error} />}

      {comparisonData && (
        <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderBatchDetails(comparisonData.batch1, batch1Label)}
              {renderBatchDetails(comparisonData.batch2, batch2DisplayLabel)}
            </div>

            <div className="pt-4 border-t dark:border-gray-700">
              <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3 text-center">Share Difference (Current vs. Previous)</h4>
              <div className="space-y-1 max-w-md mx-auto">
                {comparisonData.differences.map(diff => {
                    const diffValue = diff.diff;
                    return (
                        <div key={diff.provider} className="flex justify-between items-center text-sm p-2 rounded-md odd:bg-gray-50 dark:odd:bg-gray-700/50">
                             <span className="font-medium text-gray-700 dark:text-gray-300">{diff.provider}:</span>
                            <span className={`font-bold ${diffValue > 0 ? 'text-green-600 dark:text-green-400' : diffValue < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                                {diffValue > 0 ? '▲' : diffValue < 0 ? '▼' : ''} {diffValue.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PosmComparison;