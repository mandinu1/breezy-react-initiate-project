
import React from 'react';

interface MetricBoxProps {
  title: string;
  value: string | number;
  icon?: React.ReactElement<{ className?: string }>; // Changed from React.ReactNode
  className?: string;
  accentColor?: string; // Hex color string, e.g., '#bb1118'
  providerLogoUrl?: string; // Optional URL for provider logo
}

const MetricBox: React.FC<MetricBoxProps> = ({ title, value, icon, className = "", accentColor, providerLogoUrl }) => {
  const borderStyle = accentColor ? { borderTop: `4px solid ${accentColor}` } : {};
  
  return (
    <div 
      className={`bg-white dark:bg-dark-card p-5 rounded-lg shadow-md transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.02] ${className}`}
      style={borderStyle}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center">
            {providerLogoUrl && (
              <img 
                src={providerLogoUrl} 
                alt={`${title.replace(/ Boards| Count/i, '')} logo`} 
                className="h-6 w-auto mr-2" 
              />
            )}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
          </div>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        {icon && (
          <div 
            className={`flex-shrink-0 rounded-md p-2 text-white ${accentColor ? '' : 'bg-primary'}`} // Use accent color for icon bg if provided
            style={accentColor ? { backgroundColor: accentColor } : {}}
          >
            {React.cloneElement(icon, { className: "w-6 h-6" })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricBox;
