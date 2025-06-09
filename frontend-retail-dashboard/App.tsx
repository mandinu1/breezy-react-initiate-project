import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import BoardView from './pages/BoardView';
import PosmView from './pages/PosmView';
import ManagementView from './pages/ManagementView';
import LandingPage from './pages/LandingPage';
import { ViewMode, Page } from './types';

export type Theme = 'light' | 'dark';

// This layout component now manages the remounting of its children via a key
const DashboardLayout: React.FC<{
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  theme: Theme;
  toggleTheme: () => void;
  sidebarFilterContent: React.ReactNode | null;
  currentPage: Page;
}> = ({ viewMode, setViewMode, theme, toggleTheme, sidebarFilterContent, currentPage }) => {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-bg font-sans">
      <Sidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentPage={currentPage}
        theme={theme}
        toggleTheme={toggleTheme}
        activeFilterElement={sidebarFilterContent}
      />
      <MainContent>
        {/*
          By adding a key here that changes on navigation or viewMode change,
          we force React to unmount the old view and mount a new one,
          which effectively resets the component's internal state.
        */}
        <div key={`${currentPage}-${viewMode}`} className="h-full">
          <Outlet />
        </div>
      </MainContent>
    </div>
  );
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('sales');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [sidebarFilterContent, setSidebarFilterContent] = useState<React.ReactNode | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Determine currentPage based on the URL path
  let currentPage: Page = 'board'; // default
  if (location.pathname.startsWith('/posm')) currentPage = 'posm';
  else if (location.pathname.startsWith('/management')) currentPage = 'management';

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      
      {/* All dashboard routes are nested under the layout */}
      <Route
        path="/*"
        element={
          <DashboardLayout
            viewMode={viewMode}
            setViewMode={setViewMode}
            theme={theme}
            toggleTheme={toggleTheme}
            sidebarFilterContent={sidebarFilterContent}
            currentPage={currentPage}
          />
        }
      >
        <Route path="board" element={<BoardView viewMode={viewMode} setSidebarFilters={setSidebarFilterContent} />} />
        <Route path="posm" element={<PosmView viewMode={viewMode} setSidebarFilters={setSidebarFilterContent} />} />
        <Route path="management" element={<ManagementView setSidebarFilters={setSidebarFilterContent} />} />
        
        {/* Redirect base dashboard path to board view */}
        <Route index element={<Navigate to="/board" replace />} />
      </Route>

      {/* Fallback redirect for any unmatched path */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;