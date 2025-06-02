
import React, { useState, useEffect, useMemo } from 'react';
import SelectDropdown from '../shared/SelectDropdown';
import ImageDisplay from '../image/ImageDisplay';
import PercentageBar from '../metrics/PercentageBar';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorMessage from '../shared/ErrorMessage';
import { FilterOption, PosmComparisonData, PosmBatchDetails, ProviderConfig } from '../../types'; 
import { fetchPosmComparisonData } from '../../services/api';
import { PROVIDERS_CONFIG } from '../../constants';

interface PosmComparisonProps {
    retailerOptions: FilterOption[]; 
    selectedRetailerId: string; 
    batchOptions: FilterOption[]; // All available batches for the selected retailer
}

const PosmComparison: React.FC<PosmComparisonProps> = ({ retailerOptions, selectedRetailerId, batchOptions }) => {
  const [batch1Id, setBatch1Id] = useState<string>('');
  const [batch2Id, setBatch2Id] = useState<string>(''); // Will be auto-set to latest
  
  const [availableBatch1Options, setAvailableBatch1Options] = useState<FilterOption[]>([]);
  const [selectedBatch2Info, setSelectedBatch2Info] = useState<FilterOption | null>(null);

  const [comparisonData, setComparisonData] = useState<PosmComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const actualProviders = useMemo(() => PROVIDERS_CONFIG.filter(p => p.key !== 'all'), []);

  useEffect(() => {
    setError(null); // Clear previous errors when retailer or batches change
    setComparisonData(null); // Clear previous comparison data

    if (!selectedRetailerId || selectedRetailerId === 'all' || batchOptions.length === 0) {
        setBatch1Id('');
        setBatch2Id('');
        setAvailableBatch1Options([]);
        setSelectedBatch2Info(null);
        // Error for no batches is handled in PosmView
        return; 
    }
    
    const latestBatch = batchOptions[batchOptions.length - 1];
    if (latestBatch) {
        setBatch2Id(latestBatch.value);
        setSelectedBatch2Info(latestBatch);

        const batch1Opts = batchOptions.filter(b => b.value !== latestBatch.value);
        setAvailableBatch1Options(batch1Opts);

        if (batch1Opts.length > 0) {
            if (!batch1Opts.find(b => b.value === batch1Id) || !batch1Id) { // Also set if batch1Id is empty
                 setBatch1Id(batch1Opts[0].value);
            }
        } else {
            setBatch1Id(''); 
        }
    } else {
        setBatch2Id('');
        setSelectedBatch2Info(null);
        setAvailableBatch1Options([]);
        setBatch1Id('');
    }

  }, [selectedRetailerId, batchOptions, batch1Id]);


  const handleCompare = async () => {
    if (!selectedRetailerId || selectedRetailerId === 'all' || !batch1Id || !batch2Id) {
      setError("Please select a retailer, Batch 1, and ensure Batch 2 (latest) is available.");
      setComparisonData(null);
      return;
    }
    if (batch1Id === batch2Id) {
      setError("Batch 1 and Batch 2 must be different.");
      setComparisonData(null);
      return;
    }
    if (availableBatch1Options.length === 0) {
        setError("Not enough unique batches available for comparison with the latest batch.");
        setComparisonData(null);
        return;
    }


    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPosmComparisonData(selectedRetailerId, batch1Id, batch2Id);
      setComparisonData(data);
    } catch (err) {
      console.error("Failed to fetch comparison data:", err);
      setError("Could not load comparison data. Please try again.");
      setComparisonData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const currentRetailerLabel = retailerOptions.find(r => r.value === selectedRetailerId)?.label || "Selected Retailer";
  const batch1Label = availableBatch1Options.find(b => b.value === batch1Id)?.label || "Batch 1";
  const batch2DisplayLabel = selectedBatch2Info?.label || "Latest Batch (Batch 2)";


  if (!selectedRetailerId || selectedRetailerId === 'all') {
    return (
        <div className="space-y-6 bg-white dark:bg-dark-card p-6 rounded-lg shadow text-center">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Comparison</h3>
            <p className="text-gray-500 dark:text-gray-400">Please select a retailer from the sidebar to start a comparison.</p>
        </div>
    );
  }
  
  if (batchOptions.length === 0 && selectedRetailerId !== 'all') {
    return (
        <div className="space-y-6 bg-white dark:bg-dark-card p-6 rounded-lg shadow text-center">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Comparison for {currentRetailerLabel}</h3>
            <p className="text-gray-500 dark:text-gray-400">No batches available for this retailer.</p>
        </div>
    );
  }
  
   if (batchOptions.length > 0 && availableBatch1Options.length === 0) {
      return (
        <div className="space-y-6 bg-white dark:bg-dark-card p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Comparison for {currentRetailerLabel}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
                Only one batch ({selectedBatch2Info?.label || 'latest batch'}) is available for this retailer.
                Comparison requires at least two different batches.
            </p>
             <SelectDropdown
                label="Batch 2 (Latest - Auto-selected)"
                options={selectedBatch2Info ? [selectedBatch2Info] : [{value: '', label: 'N/A'}]}
                value={batch2Id}
                onChange={() => {}} 
                disabled={true}
            />
        </div>
    );
  }


  const renderBatchDetails = (batchDetails: PosmBatchDetails | undefined, title: string, isBatch2: boolean = false) => {
    if (!batchDetails) return <p className="text-gray-500 dark:text-gray-400">Batch data not available.</p>;
    
    return (
        <div className="p-4 border rounded-lg dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-800">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">
                {title}
            </h4>
            <ImageDisplay 
                imageUrl={batchDetails.image} 
                altText={`Image for ${title}`} 
                className="w-full h-auto rounded aspect-[3/2] object-cover" 
                defaultImageUrl="/assets/sample-retailer-placeholder.png"
            />
            {actualProviders.map(providerConfig => {
                const shareInfo = batchDetails.shares.find(s => s.provider === providerConfig.name);
                const percentage = shareInfo ? shareInfo.percentage : 0;
                return (
                    <PercentageBar 
                        key={providerConfig.key} 
                        label={providerConfig.name} 
                        percentage={percentage} 
                        color={providerConfig.color}
                        providerLogoUrl={providerConfig.logoUrl}
                    />
                );
            })}
            {isBatch2 && batchDetails.maxCapturePhase && (
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                    Max Capture Phase Detail: <span className="font-medium">{batchDetails.maxCapturePhase}</span>
                </p>
            )}
        </div>
    );
  };


  return (
    <div className="space-y-6 bg-white dark:bg-dark-card p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">POSM Comparison for <span className="text-primary dark:text-secondary">{currentRetailerLabel}</span></h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <SelectDropdown
          label="Select Batch 1"
          options={availableBatch1Options.length > 0 ? availableBatch1Options : [{value: '', label: 'N/A - No other batches'}]}
          value={batch1Id}
          onChange={(e) => setBatch1Id(e.target.value)}
          disabled={availableBatch1Options.length === 0}
        />
        <SelectDropdown
          label="Batch 2 (Latest - Auto-selected)"
          options={selectedBatch2Info ? [selectedBatch2Info] : [{value: '', label: 'N/A - No latest batch'}]}
          value={batch2Id}
          onChange={() => {}} 
          disabled={true} 
        />
      </div>
      <Button 
        onClick={handleCompare} 
        disabled={isLoading || !batch1Id || !batch2Id || batch1Id === batch2Id || availableBatch1Options.length === 0}
        className="w-full sm:w-auto"
      >
        {isLoading ? 'Comparing...' : 'Compare Batches'}
      </Button>

      {isLoading && <LoadingSpinner message="Loading comparison..." />}
      {error && <ErrorMessage title="Comparison Error" message={error} />}

      {comparisonData && !isLoading && !error && (
        <div className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderBatchDetails(comparisonData.batch1, `${batch1Label} (Batch 1)`)}
              {renderBatchDetails(comparisonData.batch2, `${batch2DisplayLabel} (Batch 2)`, true)}
            </div>

            <div className="mt-8 pt-4 border-t dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">Share Difference ({batch2DisplayLabel} vs {batch1Label})</h4>
              <div className="space-y-1">
                {actualProviders.map(providerConfig => {
                    const diffInfo = comparisonData.differences.find(d => d.provider === providerConfig.name);
                    const diffValue = diffInfo ? diffInfo.diff : 0;
                    return (
                        <div key={providerConfig.key} className="flex justify-between items-center text-sm p-2 rounded-md odd:bg-gray-50 dark:odd:bg-gray-700/50">
                             <div className="flex items-center">
                                {providerConfig.logoUrl && <img src={providerConfig.logoUrl} alt={providerConfig.name} className="h-4 w-auto mr-2"/>}
                                <span className="text-gray-600 dark:text-gray-300">{providerConfig.name}:</span>
                            </div>
                            <span className={`font-medium ${diffValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {diffValue > 0 ? '+' : ''}{diffValue.toFixed(1)}%
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
