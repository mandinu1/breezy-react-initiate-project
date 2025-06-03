import React from 'react';
import { FilterOption } from '../../types';

interface RadioGroupProps {
  label?: string;
  options: FilterOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  name: string; // HTML name attribute for radio inputs
}

const RadioGroup: React.FC<RadioGroupProps> = ({ label, options, selectedValue, onChange, name }) => {
  return (
    <div>
      {label && <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</span>}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:space-x-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex-1 relative flex items-center p-3 rounded-md border cursor-pointer transition-colors duration-150
              ${selectedValue === option.value 
                ? 'bg-primary border-primary text-white shadow-md dark:bg-secondary dark:border-secondary' 
                : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300'
              }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selectedValue === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only" // Hide actual radio, style the label
              aria-labelledby={`${name}-${option.value}-label`}
            />
            <span id={`${name}-${option.value}-label`} className="text-sm font-medium text-center w-full">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default RadioGroup;