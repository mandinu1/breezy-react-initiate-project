import React from 'react';
import { ViewMode } from '../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, setViewMode }) => {
  const toggleMode = () => {
    setViewMode(viewMode === 'sales' ? 'admin' : 'sales');
  };

  return (
    <div className="flex-grow mr-2"> {/* Allow button to take available width */}
      <button
        onClick={toggleMode}
        className="w-full px-4 py-2.5 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-150 ease-in-out
                   bg-gray-200 text-gray-700 hover:bg-gray-300
                   dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:ring-offset-dark-card"
        aria-live="polite"
      >
        Switch to {viewMode === 'sales' ? 'Administrative' : 'Sales'} View
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Current: {viewMode === 'sales' ? 'Sales' : 'Administrative'} View</p>
    </div>
  );
};

export default ViewModeToggle;