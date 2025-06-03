
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import BoardView from './pages/BoardView';
import PosmView from './pages/PosmView';
import ManagementView from './pages/ManagementView';
import { ViewMode, Page } from 'types';

export type Theme = 'light' | 'dark';

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
  
  let currentPage: Page = 'board'; // Default
  if (location.pathname.startsWith('/posm')) currentPage = 'posm';
  else if (location.pathname.startsWith('/management')) currentPage = 'management';


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
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
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
        </Routes>
      </MainContent>
    </div>
  );
};

export default App;
