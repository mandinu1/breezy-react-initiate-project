import React from 'react';
import { Link } from 'react-router-dom'; // For navigation

const LandingPage: React.FC = () => {
  // Attempt to get theme from localStorage to apply dark mode if needed
  const currentTheme = localStorage.getItem('theme') || 'light';
  React.useEffect(() => {
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentTheme]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-dark-bg text-gray-800 dark:text-gray-100 transition-colors duration-300`}>
      <header className="text-center mb-12">
        <img 
            src="/assets/mim-logo.png" 
            alt="MIM Logo" 
            className="h-24 w-auto mx-auto mb-4" 
        />
        <h1 className="text-5xl font-bold text-primary dark:text-secondary mb-3">
          Retail Visibility Hub
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Analyze and Visualize Your Brand's Presence with Precision.
        </p>
      </header>

      <main className="text-center mb-12">
        <p className="text-lg max-w-2xl mx-auto mb-8 text-gray-700 dark:text-gray-300">
          Welcome to the Retailer Brand Presence Dashboard. Gain insights into board types,
          Point of Sale Materials (POSM), locations, and competitive presence across various retailers.
          Navigate through different views to understand market dynamics and optimize your strategies.
        </p>
        <Link
          to="/board" // Link to your default dashboard view
          className="bg-primary hover:bg-blue-700 text-white dark:bg-secondary dark:hover:bg-blue-500 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-lg"
        >
          Enter Dashboard
        </Link>
      </main>

      <footer className="text-center mt-auto text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Brand Corp. All rights reserved.</p>
        <p className="mt-1">
          Powered by MIM Analytics
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;