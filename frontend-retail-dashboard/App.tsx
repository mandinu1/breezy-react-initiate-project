// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/App.tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import BoardView from './pages/BoardView';
import PosmView from './pages/PosmView';
import ManagementView from './pages/ManagementView';
import LandingPage from './pages/LandingPage'; // Import the new LandingPage
import { ViewMode, Page } from './types';

export type Theme = 'light' | 'dark';

// New component to manage the Dashboard Layout
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
        <Outlet /> {/* Child routes (BoardView, PosmView, etc.) will render here */}
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
  
  // Determine currentPage based on location for the DashboardLayout
  let currentPage: Page = 'board'; // Default for dashboard
  if (location.pathname.startsWith('/posm')) currentPage = 'posm';
  else if (location.pathname.startsWith('/management')) currentPage = 'management';
  else if (location.pathname.startsWith('/board')) currentPage = 'board';


  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      
      {/* Nested routes for dashboard views that share the DashboardLayout */}
      <Route 
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
        <Route 
          path="/board" 
          element={
            <BoardView 
              key={`/board-${viewMode}`} 
              viewMode={viewMode} 
              setSidebarFilters={setSidebarFilterContent} 
            />
          } 
        />
        <Route 
          path="/posm" 
          element={
            <PosmView 
              key={`/posm-${viewMode}`} 
              viewMode={viewMode} 
              setSidebarFilters={setSidebarFilterContent} 
            />
          } 
        />
        <Route 
          path="/management" 
          element={
            <ManagementView 
              key={`/management-${viewMode}`} 
              setSidebarFilters={setSidebarFilterContent}
            />
          } 
        />
      </Route>
      
      {/* Optional: Redirect any other unmatched path to the landing page or a 404 page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;