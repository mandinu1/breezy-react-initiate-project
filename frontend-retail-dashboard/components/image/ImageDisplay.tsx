// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-653165f7b5ee7d64c670d05e8777412d3daa000e/components/image/ImageDisplay.tsx
import React, { useState, useEffect } from 'react';
import { ImageInfo } from '../../types';
import { fetchImageInfo } from '../../services/api'; 
import LoadingSpinner from '../shared/LoadingSpinner';

interface SingleImageProps {
  imageIdentifier?: string;
  imageUrl?: string;
  defaultImageUrl?: string;
  altText: string;
  title: string;
  className?: string;
}

const SingleImage: React.FC<SingleImageProps> = ({ imageIdentifier, imageUrl, defaultImageUrl, altText, title, className=""}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>(imageUrl || defaultImageUrl);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setError(null);
      setLoading(false);
    } else if (imageIdentifier) {
      setLoading(true);
      setError(null);
      fetchImageInfo(imageIdentifier)
        .then(imageInfo => {
          setCurrentImageUrl(imageInfo.url);
        })
        .catch(err => {
          console.error(`Failed to fetch image for ${title}:`, err);
          setError(`Could not load ${title.toLowerCase()}.`);
          setCurrentImageUrl(defaultImageUrl);
        })
        .finally(() => setLoading(false));
    } else {
      setCurrentImageUrl(defaultImageUrl);
      setError(null);
      setLoading(false);
    }
  }, [imageIdentifier, imageUrl, defaultImageUrl, title]);

  if (loading) return <div className="text-center"><LoadingSpinner size="sm" message={`Loading ${title}...`}/></div>;
  if (error && !currentImageUrl) return <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>;
  if (!currentImageUrl) return <p className="text-gray-500 dark:text-gray-400 text-sm text-center">{title} not available.</p>;

  return (
     <div className={className}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 text-center">{title}</h4>
        <img
          src={currentImageUrl}
          alt={altText}
          className={`rounded-lg shadow-md object-cover w-full h-auto bg-gray-200 dark:bg-gray-700 aspect-[4/3]`}
          onError={() => {
              if (currentImageUrl !== defaultImageUrl && defaultImageUrl) {
                  setCurrentImageUrl(defaultImageUrl);
                  setError(`Original ${title.toLowerCase()} failed to load. Showing placeholder.`);
              } else if (!defaultImageUrl) {
                  setError(`${title} failed to load and no placeholder is available.`);
              }
          }}
        />
        {error && currentImageUrl === defaultImageUrl && <p className="text-orange-500 dark:text-orange-400 text-xs text-center mt-1">{error}</p>}
     </div>
  );
};


interface DualImageDisplayProps {
  originalImageIdentifier?: string;
  originalImageUrl?: string;
  detectedImageIdentifier?: string;
  detectedImageUrl?: string;
  defaultImageUrl?: string; // Common placeholder
  altTextPrefix: string;
  className?: string;
}

const DualImageDisplay: React.FC<DualImageDisplayProps> = ({
    originalImageIdentifier,
    originalImageUrl,
    detectedImageIdentifier,
    detectedImageUrl,
    defaultImageUrl = "/assets/sample-retailer-placeholder.png", // Ensure this placeholder exists in public/assets
    altTextPrefix,
    className = ""
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      <SingleImage
        imageIdentifier={originalImageIdentifier}
        imageUrl={originalImageUrl}
        defaultImageUrl={defaultImageUrl}
        altText={`${altTextPrefix} - Original`}
        title="Original Image"
        className="w-full"
      />
      <SingleImage
        imageIdentifier={detectedImageIdentifier}
        imageUrl={detectedImageUrl}
        defaultImageUrl={defaultImageUrl}
        altText={`${altTextPrefix} - Detected`}
        title="Detected/Inference Image"
        className="w-full"
      />
    </div>
  );
};

export default DualImageDisplay; 