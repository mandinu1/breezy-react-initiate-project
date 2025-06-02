
import React, { useState, useEffect, useCallback } from 'react';

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  initialValues: [number, number];
  step?: number;
  onChangeCommitted: (values: [number, number]) => void;
  disabled?: boolean;
}

const RangeSlider: React.FC<RangeSliderProps> = ({
  label,
  min,
  max,
  initialValues,
  step = 1,
  onChangeCommitted,
  disabled = false,
}) => {
  const [minValue, setMinValue] = useState<number>(initialValues[0]);
  const [maxValue, setMaxValue] = useState<number>(initialValues[1]);

  useEffect(() => {
    setMinValue(initialValues[0]);
    setMaxValue(initialValues[1]);
  }, [initialValues]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxValue - step);
    setMinValue(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minValue + step);
    setMaxValue(value);
  };

  const handleMouseUp = useCallback(() => {
    onChangeCommitted([minValue, maxValue]);
  }, [minValue, maxValue, onChangeCommitted]);


  const getBackgroundSize = (value: number) => {
    return { backgroundSize: `${((value - min) * 100) / (max - min)}% 100%` };
  };

  const rangeMinPercent = ((minValue - min) / (max - min)) * 100;
  const rangeMaxPercent = ((maxValue - min) / (max - min)) * 100;

  return (
    <div className={`w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative h-8 flex items-center">
        <div className="relative w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-full">
          <div
            className="absolute h-1 bg-primary dark:bg-secondary rounded-full"
            style={{ left: `${rangeMinPercent}%`, width: `${rangeMaxPercent - rangeMinPercent}%` }}
          ></div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={minValue}
            onChange={handleMinChange}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            disabled={disabled}
            className="absolute w-full h-1 top-0 appearance-none bg-transparent pointer-events-auto cursor-pointer focus:outline-none slider-thumb"
            style={getBackgroundSize(minValue)} 
            aria-label={`${label} minimum value`}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={maxValue}
            onChange={handleMaxChange}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            disabled={disabled}
            className="absolute w-full h-1 top-0 appearance-none bg-transparent pointer-events-auto cursor-pointer focus:outline-none slider-thumb"
            style={getBackgroundSize(maxValue)} 
            aria-label={`${label} maximum value`}
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>{minValue}</span>
        <span>{maxValue}</span>
      </div>
      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #1E40AF; /* Tailwind primary blue-700/800 */
          border-radius: 50%;
          cursor: pointer;
          margin-top: -7px; 
          position: relative;
          z-index: 10;
        }
        .slider-thumb:disabled::-webkit-slider-thumb {
          background: #9CA3AF; /* Tailwind gray-400 */
          cursor: not-allowed;
        }
        .dark .slider-thumb::-webkit-slider-thumb {
          background: #3B82F6; /* Tailwind secondary blue-500 */
        }
        .dark .slider-thumb:disabled::-webkit-slider-thumb {
          background: #4B5563; /* Tailwind gray-600 */
          cursor: not-allowed;
        }

        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #1E40AF; /* Tailwind primary blue-700/800 */
          border-radius: 50%;
          cursor: pointer;
          border: none;
          position: relative;
          z-index: 10;
        }
        .slider-thumb:disabled::-moz-range-thumb {
          background: #9CA3AF; /* Tailwind gray-400 */
          cursor: not-allowed;
        }
        .dark .slider-thumb::-moz-range-thumb {
          background: #3B82F6; /* Tailwind secondary blue-500 */
        }
        .dark .slider-thumb:disabled::-moz-range-thumb {
          background: #4B5563; /* Tailwind gray-600 */
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default RangeSlider;
