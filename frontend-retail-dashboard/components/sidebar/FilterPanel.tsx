
import React from 'react';

// Icons for buttons
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
  </svg>
);

const ArrowPathIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.204 4.016l-.09-.095a.75.75 0 011.06-1.06l.09.094a4 4 0 006.341-3.309 4.002 4.002 0 00-4.266-3.26.75.75 0 11-.332-1.456A5.502 5.502 0 0115.312 11.424zM4.688 8.576a5.5 5.5 0 019.204-4.016l.09.095a.75.75 0 01-1.06 1.06l-.09-.094a4 4 0 00-6.341 3.309 4.002 4.002 0 004.266 3.26.75.75 0 11.332 1.456A5.502 5.502 0 014.688 8.576z" clipRule="evenodd" />
  </svg>
);


interface FilterPanelProps {
  title: string;
  children: React.ReactNode;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ title, children, onApplyFilters, onResetFilters }) => {
  return (
    <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-md space-y-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2 mb-3">{title}</h3>
      <div className="space-y-3 overflow-y-auto flex-grow pr-1"> {/* Added pr-1 for scrollbar spacing if needed */}
        {children}
      </div>
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={onApplyFilters}
          className="flex-1 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition duration-150 ease-in-out
                     dark:bg-green-500 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-700"
          aria-label="Apply selected filters"
        >
          <CheckCircleIcon />
          Apply
        </button>
        <button
          onClick={onResetFilters}
          className="flex-1 flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition duration-150 ease-in-out
                     dark:bg-gray-600 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-700"
          aria-label="Reset all filters to default"
        >
          <ArrowPathIcon />
          Reset
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
