
import React, { useState, useEffect } from 'react';
import { ImageInfo } from '../../types';
import { fetchImageInfo } from '../../services/api'; 
import LoadingSpinner from '../shared/LoadingSpinner';

interface ImageDisplayProps {
  imageIdentifier?: string; 
  imageUrl?: string; 
  defaultImageUrl?: string; // For placeholder/sample image
  altText: string;
  className?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageIdentifier, imageUrl, defaultImageUrl, altText, className="" }) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>(imageUrl || defaultImageUrl);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (imageUrl) { // Prioritize direct imageUrl
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
          console.error("Failed to fetch image info:", err);
          setError("Could not load image.");
          setCurrentImageUrl(defaultImageUrl); // Fallback to default on error
        })
        .finally(() => setLoading(false));
    } else {
      setCurrentImageUrl(defaultImageUrl); // Use default if no specific identifier or URL
      setError(null);
      setLoading(false);
    }
  }, [imageIdentifier, imageUrl, defaultImageUrl]);

  if (loading) return <LoadingSpinner size="sm" message="Loading image..."/>;
  
  // If error and no currentImageUrl (even default didn't load or wasn't provided), show error.
  if (error && !currentImageUrl) return <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>;
  
  // If no currentImageUrl after all checks (e.g., no identifier, no direct URL, no default)
  if (!currentImageUrl) return <p className="text-gray-500 dark:text-gray-400 text-sm">Image not available.</p>;

  return (
    <img
      src={currentImageUrl}
      alt={altText}
      className={`rounded-lg shadow-md object-cover bg-gray-200 dark:bg-gray-700 ${className}`} 
      onError={() => { // Handle broken image links by falling back to default if not already the default
          if (currentImageUrl !== defaultImageUrl && defaultImageUrl) {
              setCurrentImageUrl(defaultImageUrl);
              setError("Original image failed to load. Showing placeholder.");
          } else if (!defaultImageUrl) {
              setError("Image failed to load and no placeholder is available.");
          }
      }}
    />
  );
};

export default ImageDisplay;
