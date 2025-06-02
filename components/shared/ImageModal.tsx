
import React from 'react';
import { XMarkIcon } from '../shared/Icons'; // Updated import path

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, altText }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[1000] p-4 transition-opacity duration-300 ease-in-out" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="image-modal-title"
    >
      <div 
        className="bg-white dark:bg-dark-card p-2 sm:p-4 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] relative transform transition-all duration-300 ease-in-out scale-95 group-hover:scale-100" // Added for entrance animation (apply .group to parent if needed)
        onClick={e => e.stopPropagation()} // Prevent closing modal when clicking on the image/card itself
      >
        <img 
            id="image-modal-title"
            src={imageUrl} 
            alt={altText} 
            className="w-full h-auto object-contain max-h-[calc(90vh-4rem)] rounded" 
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 bg-opacity-70 dark:bg-opacity-70 rounded-full p-1.5 sm:p-2 hover:bg-opacity-100 dark:hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-secondary transition-colors"
          aria-label="Close image viewer"
        >
          <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
};

export default ImageModal;