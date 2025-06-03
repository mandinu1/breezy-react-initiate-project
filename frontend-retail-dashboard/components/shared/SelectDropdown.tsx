import React from 'react';
import { FilterOption } from '../../types';

interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const SelectDropdown: React.FC<SelectDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  className = '',
  ...props
}) => {
  const selectId = props.id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md shadow-sm 
                   dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:focus:ring-secondary dark:focus:border-secondary
                   disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="dark:bg-gray-700 dark:text-gray-200">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectDropdown;