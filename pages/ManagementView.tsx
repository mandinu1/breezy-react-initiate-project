import React, { useEffect } from 'react';

interface ManagementViewProps {
  setSidebarFilters: (element: React.ReactNode | null) => void;
}

const ManagementView: React.FC<ManagementViewProps> = ({ setSidebarFilters }) => {
  const tableauDashboards = [
    { name: 'Overall Performance Dashboard', url: 'https://tableau.example.com/dashboards/overall' },
    { name: 'Sales Region Analysis', url: 'https://tableau.example.com/dashboards/sales-regions' },
    { name: 'Provider Share Trends', url: 'https://tableau.example.com/dashboards/provider-share' },
  ];

  useEffect(() => {
    setSidebarFilters(null); // Clear any filters from other views
    return () => setSidebarFilters(null); // Ensure cleanup on unmount as well
  }, [setSidebarFilters]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Management View</h2>
      <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">External Dashboards</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Access detailed reports and analytics through our Tableau dashboards.
        </p>
        <ul className="space-y-3">
          {tableauDashboards.map((dashboard, index) => (
            <li key={index}>
              <a
                href={dashboard.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary dark:text-secondary hover:text-blue-700 dark:hover:text-blue-400 hover:underline font-medium group flex items-center"
              >
                {dashboard.name}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ManagementView;