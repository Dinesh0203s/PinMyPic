import { useState, useEffect, useRef, useMemo } from 'react';
import { Photo } from '@shared/types';
import { getDisplayImageUrl, getDownloadImageUrl } from '@/utils/imagePreloader';
import { Download, Eye, Heart, HeartOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVirtualization } from '@/hooks/useVirtualization';

interface VirtualizedGalleryProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  showSaveToProfile?: boolean;
  savedPhotoIds?: string[];
  onSavePhoto?: (photoId: string) => void;
  onRemovePhoto?: (photoId: string) => void;
  savingPhotoIds?: string[];
}

const ITEM_HEIGHT = 280; // Height of each photo card
const CONTAINER_HEIGHT = 600; // Height of the gallery container

export const VirtualizedGallery = ({
  photos,
  onPhotoClick,
  showSaveToProfile = false,
  savedPhotoIds = [],
  onSavePhoto,
  onRemovePhoto,
  savingPhotoIds = []
}: VirtualizedGalleryProps) => {
  const {
    scrollElementRef,
    visibleItems,
    totalHeight,
    offsetY
  } = useVirtualization(photos, {
    itemHeight: ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 3
  });

  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (photoId: string) => {
    setLoadedImages(prev => new Set(prev).add(photoId));
  };

  const renderPhoto = (photo: Photo, index: number) => {
    const isLoaded = loadedImages.has(photo.id);
    const isSaved = savedPhotoIds.includes(photo.id);
    const isSaving = savingPhotoIds.includes(photo.id);

    return (
      <div 
        key={photo.id}
        className="relative bg-white rounded-lg shadow-md overflow-hidden group hover:shadow-lg transition-all duration-200"
        style={{ height: ITEM_HEIGHT - 20, margin: '10px' }}
      >
        <div className="relative h-full">
          <img
            src={getDisplayImageUrl(photo.url || '', true)}
            alt={`Photo ${index + 1}`}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => handleImageLoad(photo.id)}
            loading="lazy"
          />
          
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onPhotoClick?.(photo)}
                className="bg-white/90 hover:bg-white text-black"
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = getDownloadImageUrl(photo.url || '');
                  link.download = `photo-${photo.id}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-white/90 hover:bg-white text-black"
              >
                <Download className="h-4 w-4" />
              </Button>

              {showSaveToProfile && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (isSaved) {
                      onRemovePhoto?.(photo.id);
                    } else {
                      onSavePhoto?.(photo.id);
                    }
                  }}
                  disabled={isSaving}
                  className={`${
                    isSaved 
                      ? 'bg-pink-500 hover:bg-pink-600 text-white' 
                      : 'bg-white/90 hover:bg-white text-black'
                  }`}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isSaved ? (
                    <Heart className="h-4 w-4 fill-current" />
                  ) : (
                    <HeartOff className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div 
        ref={scrollElementRef}
        className="overflow-auto"
        style={{ height: CONTAINER_HEIGHT }}
      >
        <div 
          className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4"
          style={{ height: totalHeight }}
        >
          <div 
            className="absolute inset-x-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {visibleItems.map((photo, index) => renderPhoto(photo, index))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualizedGallery;