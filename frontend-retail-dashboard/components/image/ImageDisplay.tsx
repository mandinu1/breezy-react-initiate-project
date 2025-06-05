// mandinu1/breezy-react-initiate-project/breezy-react-initiate-project-0fa4c536d6929256228f28fa08a2914fae3eabac/frontend-retail-dashboard/components/image/ImageDisplay.tsx
import React, { useState, useEffect } from 'react';
import { ImageInfo } from '../../types';
import { fetchImageInfo } from '../../services/api';
import LoadingSpinner from '../shared/LoadingSpinner';
import ImageModal from '../shared/ImageModal'; // Import ImageModal

interface SingleImageProps {
  imageIdentifier?: string;
  imageUrl?: string;
  defaultImageUrl?: string;
  altText: string;
  title: string;
  className?: string;
}

// Export SingleImage so it can be used directly
export const SingleImage: React.FC<SingleImageProps> = ({
  imageIdentifier,
  imageUrl,
  defaultImageUrl = "/assets/sample-retailer-placeholder.png", // Provide a default here
  altText,
  title,
  className = ""
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(defaultImageUrl); // Initialize with default
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  // modalImageUrl will be currentImageUrl when modal is opened

  useEffect(() => {
    // Prioritize direct imageUrl if provided
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setError(null);
      setLoading(false);
      return;
    }
    // Then, try to fetch if imageIdentifier is provided
    if (imageIdentifier) {
      setLoading(true);
      setError(null);
      fetchImageInfo(imageIdentifier)
        .then(imageInfo => {
          if (imageInfo && imageInfo.url) {
            setCurrentImageUrl(imageInfo.url);
          } else {
            // Fallback if fetchImageInfo returns unusable data but no error
            setCurrentImageUrl(defaultImageUrl);
            setError(`Image data for ${title} was incomplete.`);
          }
        })
        .catch(err => {
          console.error(`Failed to fetch image for ${title}:`, err);
          setError(`Could not load ${title.toLowerCase()}.`);
          setCurrentImageUrl(defaultImageUrl);
        })
        .finally(() => setLoading(false));
    } else {
      // If neither imageUrl nor imageIdentifier, use default
      setCurrentImageUrl(defaultImageUrl);
      setError(null);
      setLoading(false);
    }
  }, [imageIdentifier, imageUrl, defaultImageUrl, title]);

  const handleImageClick = () => {
    if (currentImageUrl && currentImageUrl !== defaultImageUrl) { // Optionally prevent modal for placeholder
      setIsModalOpen(true);
    } else if (currentImageUrl === defaultImageUrl && !error && !imageIdentifier && !imageUrl) {
      // If it's just the placeholder without any attempt to load something else, maybe don't open modal
      // Or, allow opening for consistency:
      setIsModalOpen(true);
    } else if (currentImageUrl) { // Allow opening even if it's a fallback due to error
        setIsModalOpen(true);
    }
  };

  const handleImageError = () => {
    if (currentImageUrl !== defaultImageUrl) { // Avoid loop if default itself fails
        setCurrentImageUrl(defaultImageUrl);
        setError(`${title} failed to load. Displaying placeholder.`);
    } else if (!defaultImageUrl) {
        setError(`${title} failed to load and no placeholder is available.`);
    }
    // If defaultImageUrl also fails, error message will be shown, image src will be broken.
  };


  if (loading) return <div className={`text-center flex justify-center items-center h-full ${className.includes('aspect-') ? className : 'aspect-[4/3]'} bg-gray-100 dark:bg-gray-700 rounded-lg`}><LoadingSpinner size="sm" message={`Loading ${title}...`}/></div>;
  // If there's an error AND currentImageUrl is the placeholder (meaning original failed) or no image at all
  if (error && (currentImageUrl === defaultImageUrl || !currentImageUrl)) {
    return (
        <div className={className}>
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 text-center">{title}</h4>
            <img
                src={defaultImageUrl} // Attempt to show placeholder even on error
                alt={altText}
                className={`rounded-lg shadow-md object-cover w-full h-auto bg-gray-200 dark:bg-gray-700 ${className.includes('aspect-') ? '' : 'aspect-[4/3]'} cursor-pointer`}
                onClick={handleImageClick} // Allow opening placeholder in modal
                onError={() => { /* Placeholder itself failed, error already set */ }}
            />
            <p className="text-red-500 dark:text-red-400 text-xs text-center mt-1">{error}</p>
            {isModalOpen && <ImageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} imageUrl={defaultImageUrl} altText={altText} />}
        </div>
    );
  }
  if (!currentImageUrl) return <div className={className}><h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 text-center">{title}</h4><p className="text-gray-500 dark:text-gray-400 text-sm text-center">{title} not available.</p></div>;


  return (
     <div className={className}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 text-center">{title}</h4>
        <img
          src={currentImageUrl}
          alt={altText}
          className={`rounded-lg shadow-md object-cover w-full h-auto bg-gray-200 dark:bg-gray-700 ${className.includes('aspect-') ? '' : 'aspect-[4/3]'} cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={handleImageClick}
          onError={handleImageError}
        />
        {error && currentImageUrl === defaultImageUrl && <p className="text-orange-500 dark:text-orange-400 text-xs text-center mt-1">{error}</p>}
        {isModalOpen && <ImageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} imageUrl={currentImageUrl} altText={altText} />}
     </div>
  );
};


interface DualImageDisplayProps {
  originalImageIdentifier?: string;
  originalImageUrl?: string;
  detectedImageIdentifier?: string;
  detectedImageUrl?: string;
  defaultImageUrl?: string;
  altTextPrefix: string;
  className?: string;
}

const DualImageDisplay: React.FC<DualImageDisplayProps> = ({
    originalImageIdentifier,
    originalImageUrl,
    detectedImageIdentifier,
    detectedImageUrl,
    defaultImageUrl = "/assets/sample-retailer-placeholder.png",
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
        altText={`${altTextPrefix} - Detected/Inference`}
        title="Detected/Inference Image"
        className="w-full"
      />
    </div>
  );
};

export default DualImageDisplay;