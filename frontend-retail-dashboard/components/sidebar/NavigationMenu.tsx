
import React from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import { Page } from '../../types';
import { 
    TagIcon,         // New icon for Board View
    ChartPieIcon,    // New icon for POSM View
    TableCellsIcon,  // New icon for Management View
    IconProps 
} from '../shared/Icons';

// NAV_ITEMS now uses updated icons
const NAV_ITEMS: { page: Page; label: string; path: string, icon?: React.ReactElement<IconProps> }[] = [
  { page: 'board', label: 'Board View', path: '/board', icon: <TagIcon /> },
  { page: 'posm', label: 'POSM View', path: '/posm', icon: <ChartPieIcon /> },
  { page: 'management', label: 'Management View', path: '/management', icon: <TableCellsIcon /> },
];


const NavigationMenu: React.FC = () => {
  return (
    <nav>
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">Views</h2>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.page}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out group
                ${isActive
                  ? 'bg-secondary text-white shadow-md dark:bg-blue-600' // Active state
                  : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white' // Inactive state
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.icon && React.cloneElement(item.icon, { 
                    className: `w-5 h-5 mr-3 transition-colors duration-150 ease-in-out ${
                      isActive
                        ? 'text-white' 
                        : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400' 
                    }`
                  })}
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default NavigationMenu;
