import { useState, useEffect, useRef, useMemo } from 'react';
import { Download, Eye, Loader2, Image as ImageIcon, Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Photo } from '@shared/types';
import { getDisplayImageUrl, getDownloadImageUrl } from '@/utils/imagePreloader';
import { DeleteConfirmation } from '@/components/ui/confirmation-alert';

interface AdminPhotoGalleryProps {
  photos: Photo[];
  loading?: boolean;
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (photoId: string) => void;
  onSetAsThumbnail?: (photoUrl: string) => void;
  currentThumbnailUrl?: string;
  deletingPhotoId?: string | null;
  uploadingThumbnail?: boolean;
  className?: string;
}

interface PhotoWithLoading extends Photo {
  loaded?: boolean;
  error?: boolean;
}

const AdminPhotoGallery = ({ 
  photos, 
  loading = false, 
  onPhotoClick, 
  onDeletePhoto,
  onSetAsThumbnail,
  currentThumbnailUrl,
  deletingPhotoId,
  uploadingThumbnail,
  className = "" 
}: AdminPhotoGalleryProps) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 }); // Start with 50 photos
  const [loadedPhotoIds, setLoadedPhotoIds] = useState<Set<string>>(new Set());
  const [errorPhotoIds, setErrorPhotoIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset state when photos change
  useEffect(() => {
    setVisibleRange({ start: 0, end: 50 });
    setLoadedPhotoIds(new Set());
    setErrorPhotoIds(new Set());
  }, [photos]);

  // Optimized scroll handler with throttling
  useEffect(() => {
    if (!containerRef.current || !Array.isArray(photos)) return;

    let timeoutId: NodeJS.Timeout;
    
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (!containerRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
        
        // Load more photos when user scrolls to 70% of current content
        if (scrollPercentage > 0.7 && visibleRange.end < photos.length && !isLoadingMore) {
          setIsLoadingMore(true);
          
          // Load more photos in batches
          const nextBatchSize = Math.min(50, photos.length - visibleRange.end);
          setVisibleRange(prev => ({
            ...prev,
            end: prev.end + nextBatchSize
          }));
          
          // Reset loading state after a short delay
          setTimeout(() => setIsLoadingMore(false), 300);
        }
      }, 100); // Throttle scroll events
    };

    containerRef.current.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      containerRef.current?.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [photos, visibleRange.end, isLoadingMore]);

  // Intersection observer for lazy loading individual images
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const photoId = entry.target.getAttribute('data-photo-id');
            if (photoId && !loadedPhotoIds.has(photoId) && !errorPhotoIds.has(photoId)) {
              const img = entry.target.querySelector('img') as HTMLImageElement;
              if (img && !img.src) {
                const photo = photos.find(p => p.id === photoId);
                if (photo) {
                  img.src = photo.url;
                }
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '200px', // Load images 200px before they come into view
        threshold: 0.1
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [photos, loadedPhotoIds, errorPhotoIds]);

  const handleImageLoad = (photoId: string) => {
    setLoadedPhotoIds(prev => new Set(prev).add(photoId));
  };

  const handleImageError = (photoId: string) => {
    setErrorPhotoIds(prev => new Set(prev).add(photoId));
  };

  const visiblePhotos = useMemo(() => {
    if (!Array.isArray(photos)) {
      return [];
    }
    return photos.slice(visibleRange.start, visibleRange.end);
  }, [photos, visibleRange]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        <span className="text-gray-600">Loading photos...</span>
      </div>
    );
  }

  if (!Array.isArray(photos) || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-gray-500">
        <ImageIcon className="h-16 w-16" />
        <p className="text-lg font-medium">No photos uploaded</p>
        <p className="text-sm">Photos will appear here once they are uploaded to this event</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`max-h-[85vh] overflow-y-auto ${className}`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 p-2">
        {visiblePhotos.map((photo) => (
          <AdminPhotoCard
            key={photo.id}
            photo={photo}
            isLoaded={loadedPhotoIds.has(photo.id)}
            hasError={errorPhotoIds.has(photo.id)}
            onLoad={() => handleImageLoad(photo.id)}
            onError={() => handleImageError(photo.id)}
            onPhotoClick={onPhotoClick}
            onDeletePhoto={onDeletePhoto}
            onSetAsThumbnail={onSetAsThumbnail}
            currentThumbnailUrl={currentThumbnailUrl}
            deletingPhotoId={deletingPhotoId}
            uploadingThumbnail={uploadingThumbnail}
            observer={observerRef.current}
          />
        ))}
      </div>
      
      {/* Loading more indicator */}
      {Array.isArray(photos) && visibleRange.end < photos.length && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
          <span className="ml-2 text-gray-600">
            {isLoadingMore ? 'Loading more photos...' : `Showing ${visibleRange.end} of ${photos.length} photos`}
          </span>
        </div>
      )}
      
      {/* Photos counter - only show when not loading more */}
      {!isLoadingMore && (
        <div className="text-center py-4 text-sm text-gray-500">
          Showing {visibleRange.end} of {Array.isArray(photos) ? photos.length : 0} photos
        </div>
      )}
    </div>
  );
};

interface AdminPhotoCardProps {
  photo: Photo;
  isLoaded: boolean;
  hasError: boolean;
  onLoad: () => void;
  onError: () => void;
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (photoId: string) => void;
  onSetAsThumbnail?: (photoUrl: string) => void;
  currentThumbnailUrl?: string;
  deletingPhotoId?: string | null;
  uploadingThumbnail?: boolean;
  observer: IntersectionObserver | null;
}

const AdminPhotoCard = ({ 
  photo, 
  isLoaded,
  hasError,
  onLoad, 
  onError, 
  onPhotoClick, 
  onDeletePhoto,
  onSetAsThumbnail,
  currentThumbnailUrl,
  deletingPhotoId,
  uploadingThumbnail,
  observer 
}: AdminPhotoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isThumbnail = currentThumbnailUrl === photo.url;

  useEffect(() => {
    if (observer && cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => {
      if (observer && cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [observer]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Use original quality URL for downloads
      const originalUrl = getDownloadImageUrl(photo.url);
      const response = await fetch(originalUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  return (
    <div
      ref={cardRef}
      data-photo-id={photo.id}
      className={`aspect-square relative group overflow-hidden rounded-lg border bg-gray-100 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-lg ${
        isThumbnail ? 'ring-2 ring-green-500' : ''
      }`}
      onClick={() => onPhotoClick?.(photo)}
    >
      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <ImageIcon className="h-6 w-6 text-gray-400" />
        </div>
      )}
      
      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
      
      {/* Thumbnail badge */}
      {isThumbnail && (
        <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full z-10">
          T
        </div>
      )}
      
      {/* Image */}
      {!hasError && (
        <img
          src={isLoaded ? photo.url : undefined}
          alt={photo.filename}
          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
        />
      )}
      
      {/* Filename overlay - only show on hover for smaller cards */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {photo.filename}
      </div>
      
      {/* Hover overlay with admin actions */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap gap-1 p-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/90 hover:bg-white h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onPhotoClick?.(photo);
            }}
            title="View full size"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/90 hover:bg-white h-6 w-6 p-0"
            onClick={handleDownload}
            title="Download photo"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={`h-6 w-6 p-0 ${isThumbnail ? "bg-green-500 text-white" : "bg-white/90 hover:bg-white"}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetAsThumbnail?.(photo.url);
            }}
            disabled={uploadingThumbnail || isThumbnail}
            title={isThumbnail ? "Current thumbnail" : "Set as thumbnail"}
          >
            <Camera className="h-3 w-3" />
          </Button>
          <DeleteConfirmation
            itemName={photo.filename || `Photo ${photo.id.slice(-6)}`}
            itemType="photo"
            onConfirm={() => onDeletePhoto?.(photo.id)}
            disabled={deletingPhotoId === photo.id}
            trigger={
              <Button
                variant="secondary"
                size="sm"
                className="bg-red-500/90 hover:bg-red-500 text-white h-6 w-6 p-0"
                disabled={deletingPhotoId === photo.id}
                title="Delete photo"
                onClick={(e) => e.stopPropagation()}
              >
                {deletingPhotoId === photo.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default AdminPhotoGallery;