
import React from 'react';

interface PercentageBarProps {
  label: string;
  percentage: number; // 0 to 100
  color?: string; // Tailwind color class e.g., 'bg-blue-500' OR hex color string e.g. '#FF0000'
  providerLogoUrl?: string; // Optional URL for provider logo
}

const PercentageBar: React.FC<PercentageBarProps> = ({ label, percentage, color = 'bg-secondary', providerLogoUrl }) => {
  const safePercentage = Math.max(0, Math.min(100, percentage));
  const isHexColor = color && color.startsWith('#');

  const barStyle: React.CSSProperties = {
    width: `${safePercentage}%`,
  };
  if (isHexColor) {
    barStyle.backgroundColor = color;
  }

  const barClassName = `h-2.5 rounded-full ${!isHexColor ? color : ''} transition-all duration-500 ease-out`;

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <div className="flex items-center">
          {providerLogoUrl && (
            <img 
              src={providerLogoUrl} 
              alt={`${label} logo`}
              className="h-5 w-auto mr-2" // Adjust size as needed
            />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span 
          className={`text-sm font-medium`}
          style={isHexColor ? { color: color } : {}} // Apply color to text if hex, else relies on Tailwind primary/secondary
        >
          {safePercentage.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={barClassName}
          style={barStyle}
          role="progressbar"
          aria-valuenow={safePercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} progress`}
        ></div>
      </div>
    </div>
  );
};

export default PercentageBar;