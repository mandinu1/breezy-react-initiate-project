
import React from 'react';
import { ViewMode, Page } from '../../types';
import { Theme } from '../../frontend-retail-dashboard/App'; // Assuming Theme type is exported from App.tsx
import ViewModeToggle from '../sidebar/ViewModeToggle';
import NavigationMenu from '../sidebar/NavigationMenu';
import { SunIcon, MoonIcon } from '../shared/Icons'; // Import icons from the new central file
// FilterPanel will be rendered by individual pages and passed via activeFilterElement


interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentPage: Page; // Kept for potential direct use, though NavLink handles active state
  theme: Theme;
  toggleTheme: () => void;
  activeFilterElement?: React.ReactNode;
}


const Sidebar: React.FC<SidebarProps> = ({ viewMode, setViewMode, theme, toggleTheme, activeFilterElement }) => {
  const localMimLogoUrl = "/assets/mim-logo.png"; // Local path for MIM logo

  return (
    <div className="w-80 bg-white dark:bg-gray-800 h-full shadow-lg p-5 space-y-6 overflow-y-auto flex flex-col">
      <div className="flex items-center space-x-3 mb-4"> {/* Container for logo and title */}
        <img 
          src={localMimLogoUrl} 
          alt="MIM Logo" 
          className="h-12 w-auto" // Adjusted height
        />
        <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white leading-tight">
                MIM
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-tight">Retail Visibility Hub</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>

      <NavigationMenu />
      
      <div className="flex-grow"> {/* This div will contain filters and take remaining space */}
        {activeFilterElement}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">© 2024 Brand Corp</p>
      </div>
    </div>
  );
};

export default Sidebar;