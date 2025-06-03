import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4" role="status" aria-live="polite">
      <div
        className={`animate-spin rounded-full border-4 border-t-4 border-gray-200 dark:border-gray-600 border-t-primary dark:border-t-secondary ${sizeClasses[size]}`}
      ></div>
      {message && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;