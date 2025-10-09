import { useState, useEffect, useRef, useMemo } from 'react';
import { Download, Eye, Loader2, Image as ImageIcon, Camera, Trash2, Check, Square, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Photo } from '@shared/types';
import { getDisplayImageUrl, getDownloadImageUrl } from '@/utils/imagePreloader';
import { DeleteConfirmation } from '@/components/ui/confirmation-alert';
import { CaptchaVerification } from '@/components/CaptchaVerification';

interface AdminPhotoGalleryProps {
  photos: Photo[];
  loading?: boolean;
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (photoId: string) => void;
  onBulkDeletePhotos?: (photoIds: string[]) => Promise<void>;
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
  onBulkDeletePhotos,
  onSetAsThumbnail,
  currentThumbnailUrl,
  deletingPhotoId,
  uploadingThumbnail,
  className = "" 
}: AdminPhotoGalleryProps) => {
  const [loadedPhotos, setLoadedPhotos] = useState<PhotoWithLoading[]>([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showCaptchaDialog, setShowCaptchaDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize photos with loading states
  useEffect(() => {
    if (Array.isArray(photos)) {
      setLoadedPhotos(photos.map(photo => ({ ...photo, loaded: false, error: false })));
    } else {
      setLoadedPhotos([]);
    }
  }, [photos]);

  // Virtualized scrolling - load more photos as user scrolls
  useEffect(() => {
    if (!containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current || isLoadingMore) return;
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Throttle scroll events
      scrollTimeoutRef.current = setTimeout(() => {
        if (!containerRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
        
        // Load more photos when user scrolls to 80% of current content
        if (scrollPercentage > 0.8 && Array.isArray(photos) && visibleRange.end < photos.length) {
          setIsLoadingMore(true);
          setVisibleRange(prev => ({
            ...prev,
            end: Math.min(prev.end + 20, photos.length)
          }));
          
          // Reset loading state after a short delay
          setTimeout(() => setIsLoadingMore(false), 500);
        }
      }, 100); // Throttle to 100ms
    };

    containerRef.current.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      containerRef.current?.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [Array.isArray(photos) ? photos.length : 0, visibleRange.end, isLoadingMore]);

  // Intersection observer for lazy loading
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const photoId = entry.target.getAttribute('data-photo-id');
            if (photoId) {
              // Find the photo and trigger loading
              const photo = loadedPhotos.find(p => p.id === photoId);
              if (photo && !photo.loaded && !photo.error) {
                const img = entry.target.querySelector('img') as HTMLImageElement;
                if (img && !img.src) {
                  img.src = photo.url;
                }
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '100px', // Load images 100px before they come into view
        threshold: 0.1
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadedPhotos]);

  const handleImageLoad = (photoId: string) => {
    setLoadedPhotos(prev => 
      prev.map(photo => 
        photo.id === photoId ? { ...photo, loaded: true } : photo
      )
    );
  };

  const handleImageError = (photoId: string) => {
    setLoadedPhotos(prev => 
      prev.map(photo => 
        photo.id === photoId ? { ...photo, error: true } : photo
      )
    );
  };

  const handlePhotoSelect = (photoId: string) => {
    if (!isMultiSelectMode) return;
    
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    // Check if all photos in the event are selected (not just visible ones)
    const allPhotoIds = Array.isArray(photos) ? photos.map(photo => photo.id) : [];
    const allSelected = allPhotoIds.length > 0 && allPhotoIds.every(id => selectedPhotos.has(id));
    
    if (allSelected) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(allPhotoIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return;
    setShowCaptchaDialog(true);
  };

  const handleCaptchaVerify = async (captchaResponse: string) => {
    if (!onBulkDeletePhotos || selectedPhotos.size === 0) return;
    
    // Validate photo IDs before sending
    const photoIds = Array.from(selectedPhotos);
    const invalidIds = photoIds.filter(id => !id || typeof id !== 'string' || id.trim() === '');
    
    if (invalidIds.length > 0) {
      console.error('Invalid photo IDs found:', invalidIds);
      return;
    }
    
    // Check if all selected photos exist in the current photos array
    const existingPhotoIds = photos.map(p => p.id);
    const nonExistentIds = photoIds.filter(id => !existingPhotoIds.includes(id));
    
    if (nonExistentIds.length > 0) {
      console.error('Some selected photos no longer exist:', nonExistentIds);
      // Remove non-existent photos from selection
      setSelectedPhotos(prev => {
        const newSet = new Set(prev);
        nonExistentIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      return;
    }
    
    setIsBulkDeleting(true);
    setShowCaptchaDialog(false);
    
    try {
      await onBulkDeletePhotos(photoIds);
      setSelectedPhotos(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false);
    setSelectedPhotos(new Set());
  };

  const handleLoadMore = () => {
    if (!Array.isArray(photos) || visibleRange.end >= photos.length || isLoadingMore) return;
    
    setIsLoadingMore(true);
    setVisibleRange(prev => ({
      ...prev,
      end: Math.min(prev.end + 20, photos.length)
    }));
    
    // Reset loading state after a short delay
    setTimeout(() => setIsLoadingMore(false), 500);
  };

  const visiblePhotos = useMemo(() => {
    if (!Array.isArray(loadedPhotos)) {
      return [];
    }
    return loadedPhotos.slice(visibleRange.start, visibleRange.end);
  }, [loadedPhotos, visibleRange]);

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
    <>
      {/* Bulk Operations Toolbar */}
      {isMultiSelectMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-800">
                {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-blue-600 border-blue-300 hover:bg-blue-100"
              >
                {(() => {
                  const allPhotoIds = Array.isArray(photos) ? photos.map(photo => photo.id) : [];
                  const allSelected = allPhotoIds.length > 0 && allPhotoIds.every(id => selectedPhotos.has(id));
                  return allSelected ? 'Deselect All' : 'Select All';
                })()}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedPhotos.size === 0 || isBulkDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedPhotos.size})
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exitMultiSelectMode}
                disabled={isBulkDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-select toggle */}
      {!isMultiSelectMode && Array.isArray(photos) && photos.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMultiSelectMode(true)}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            <Square className="h-4 w-4 mr-2" />
            Select Multiple
          </Button>
        </div>
      )}

      <div 
        ref={containerRef}
        className={`max-h-[60vh] overflow-y-auto ${className}`}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
          {visiblePhotos.map((photo) => (
            <AdminPhotoCard
              key={photo.id}
              photo={photo}
              onLoad={() => handleImageLoad(photo.id)}
              onError={() => handleImageError(photo.id)}
              onPhotoClick={onPhotoClick}
              onDeletePhoto={onDeletePhoto}
              onSetAsThumbnail={onSetAsThumbnail}
              currentThumbnailUrl={currentThumbnailUrl}
              deletingPhotoId={deletingPhotoId}
              uploadingThumbnail={uploadingThumbnail}
              observer={observerRef.current}
              isMultiSelectMode={isMultiSelectMode}
              isSelected={selectedPhotos.has(photo.id)}
              onSelect={() => handlePhotoSelect(photo.id)}
            />
          ))}
        </div>
        
        {/* Loading more indicator and manual load more button */}
        {Array.isArray(photos) && visibleRange.end < photos.length && (
          <div className="flex flex-col items-center py-6 space-y-4">
            {isLoadingMore && (
              <div className="flex items-center">
                <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                <span className="ml-2 text-gray-600">Loading more photos...</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-6 py-2"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  Load More Photos ({photos.length - visibleRange.end} remaining)
                </>
              )}
            </Button>
          </div>
        )}
        
        {/* Photos counter */}
        <div className="text-center py-4 text-sm text-gray-500">
          Showing {visibleRange.end} of {Array.isArray(photos) ? photos.length : 0} photos
        </div>
      </div>

      {/* Captcha Verification Dialog */}
      <CaptchaVerification
        isOpen={showCaptchaDialog}
        onClose={() => setShowCaptchaDialog(false)}
        onVerify={handleCaptchaVerify}
        title="Delete All Selected Photos"
        description={`You are about to permanently delete ${selectedPhotos.size} photos. This action cannot be undone.`}
        actionText={`DELETE ${selectedPhotos.size} PHOTOS`}
        loading={isBulkDeleting}
      />
    </>
  );
};

interface AdminPhotoCardProps {
  photo: PhotoWithLoading;
  onLoad: () => void;
  onError: () => void;
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (photoId: string) => void;
  onSetAsThumbnail?: (photoUrl: string) => void;
  currentThumbnailUrl?: string;
  deletingPhotoId?: string | null;
  uploadingThumbnail?: boolean;
  observer: IntersectionObserver | null;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const AdminPhotoCard = ({ 
  photo, 
  onLoad, 
  onError, 
  onPhotoClick, 
  onDeletePhoto,
  onSetAsThumbnail,
  currentThumbnailUrl,
  deletingPhotoId,
  uploadingThumbnail,
  observer,
  isMultiSelectMode = false,
  isSelected = false,
  onSelect
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isMultiSelectMode) {
      e.stopPropagation();
      onSelect?.();
    } else {
      onPhotoClick?.(photo);
    }
  };

  return (
    <div
      ref={cardRef}
      data-photo-id={photo.id}
      className={`aspect-square relative group overflow-hidden rounded-lg border bg-gray-100 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-lg ${
        isThumbnail ? 'ring-2 ring-green-500' : ''
      } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${
        isMultiSelectMode ? 'cursor-pointer' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Error state */}
      {photo.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      
      {/* Selection checkbox */}
      {isMultiSelectMode && (
        <div className="absolute top-2 left-2 z-20">
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
            isSelected 
              ? 'bg-blue-500 border-blue-500 text-white' 
              : 'bg-white border-gray-300 hover:border-blue-400'
          }`}>
            {isSelected && <Check className="h-4 w-4" />}
          </div>
        </div>
      )}

      {/* Thumbnail badge */}
      {isThumbnail && (
        <div className={`absolute top-2 ${isMultiSelectMode ? 'right-2' : 'left-2'} bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10`}>
          Thumbnail
        </div>
      )}
      
      {/* Image */}
      <img
        src={photo.url}
        alt={photo.filename}
        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
      />
      
      {/* Filename overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 truncate">
        {photo.filename}
      </div>
      
      {/* Hover overlay with admin actions */}
      {!isMultiSelectMode && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex flex-wrap gap-2 p-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/90 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onPhotoClick?.(photo);
            }}
            title="View full size"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/90 hover:bg-white"
            onClick={handleDownload}
            title="Download photo"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={`${isThumbnail ? "bg-green-500 text-white" : "bg-white/90 hover:bg-white"}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetAsThumbnail?.(photo.url);
            }}
            disabled={uploadingThumbnail || isThumbnail}
            title={isThumbnail ? "Current thumbnail" : "Set as thumbnail"}
          >
            <Camera className="h-4 w-4" />
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
                className="bg-red-500/90 hover:bg-red-500 text-white"
                disabled={deletingPhotoId === photo.id}
                title="Delete photo"
                onClick={(e) => e.stopPropagation()}
              >
                {deletingPhotoId === photo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            }
          />
        </div>
        </div>
      )}
      
      {/* Loading indicator for individual photos */}
      {!photo.loaded && !photo.error && (
        <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1">
          <Loader2 className="h-3 w-3 animate-spin text-white" />
        </div>
      )}
    </div>
  );
};

export default AdminPhotoGallery;