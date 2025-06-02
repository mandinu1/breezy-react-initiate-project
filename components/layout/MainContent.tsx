import React from 'react';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  return (
    <main className="flex-1 p-6 overflow-y-auto bg-gray-100 dark:bg-dark-bg">
      {children}
    </main>
  );
};

export default MainContent;