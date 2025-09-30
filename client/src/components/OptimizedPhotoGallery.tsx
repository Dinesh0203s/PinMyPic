import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Download, Eye, Loader2, Image as ImageIcon, Heart, HeartOff, CheckCircle, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Photo } from '@shared/types';
import { imagePreloader, getOptimizedImageUrl, getDisplayImageUrl, getDownloadImageUrl } from '@/utils/imagePreloader';
import { useSinglePhotoDownload } from '@/hooks/useSinglePhotoDownload';
import SingleDownloadProgress from '@/components/SingleDownloadProgress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ProgressiveImage from './ProgressiveImage';

interface OptimizedPhotoGalleryProps {
  photos: Photo[];
  loading?: boolean;
  onPhotoClick?: (photo: Photo) => void;
  className?: string;
  showSaveToProfile?: boolean;
  savedPhotoIds?: string[];
  onSavePhoto?: (photoId: string) => void;
  onRemovePhoto?: (photoId: string) => void;
  savingPhotoIds?: string[];
  onDeletePhoto?: (photoId: string) => void;
  canDelete?: boolean;
}

interface PhotoWithLoading extends Photo {
  loaded?: boolean;
  error?: boolean;
}

const OptimizedPhotoGallery = ({ 
  photos, 
  loading = false, 
  onPhotoClick, 
  className = "", 
  showSaveToProfile = false,
  savedPhotoIds = [],
  onSavePhoto,
  onRemovePhoto,
  savingPhotoIds = [],
  onDeletePhoto,
  canDelete = false
}: OptimizedPhotoGalleryProps) => {
  const [loadedPhotos, setLoadedPhotos] = useState<PhotoWithLoading[]>([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 8 });
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { currentUser } = useAuth();
  
  // Single photo download hook
  const { downloadPhoto, activeDownloads } = useSinglePhotoDownload();
  const { toast } = useToast();

  // Multi-select functionality state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Multi-select handlers
  const enterMultiSelectMode = useCallback(() => {
    setMultiSelectMode(true);
  }, []);

  const exitMultiSelectMode = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedPhotos(new Set());
  }, []);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  const selectAllPhotos = useCallback(() => {
    setSelectedPhotos(new Set(photos.map(photo => photo.id)));
  }, [photos]);

  const handleBulkDownload = useCallback(async () => {
    if (selectedPhotos.size === 0) return;

    toast({
      title: "Downloading photos",
      description: `Starting download of ${selectedPhotos.size} photos...`
    });

    const selectedPhotoList = photos.filter(photo => selectedPhotos.has(photo.id));
    
    // Download each photo individually (browser will handle multiple downloads)
    for (const photo of selectedPhotoList) {
      try {
        const originalUrl = getDownloadImageUrl(photo.url);
        const response = await fetch(originalUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = photo.filename || `photo-${photo.id}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Error downloading photo:', error);
      }
    }

    toast({
      title: "Downloads complete",
      description: `${selectedPhotos.size} photos downloaded successfully`
    });
  }, [selectedPhotos, photos, toast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedPhotos.size === 0 || !onDeletePhoto) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedPhotos.size} selected photos? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setIsDeletingSelected(true);
    
    try {
      const deletePromises = Array.from(selectedPhotos).map(photoId => onDeletePhoto(photoId));
      await Promise.all(deletePromises);
      
      toast({
        title: "Photos deleted",
        description: `${selectedPhotos.size} photos deleted successfully`
      });
      
      exitMultiSelectMode();
    } catch (error) {
      console.error('Error deleting photos:', error);
      toast({
        title: "Delete failed",
        description: "Some photos could not be deleted. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingSelected(false);
    }
  }, [selectedPhotos, onDeletePhoto, toast, exitMultiSelectMode]);

  // Initialize photos with loading states and smart preloading
  useEffect(() => {
    if (Array.isArray(photos)) {
      setLoadedPhotos(photos.map(photo => ({ ...photo, loaded: false, error: false })));
      
      // Smart preload visible images with thumbnails
      const imageSources = photos.map(photo => getDisplayImageUrl(photo.url || '', true));
      imagePreloader.preloadWithConnectionAwareness(imageSources, 'high');
      
      // Optimize cache periodically
      imagePreloader.optimizeCache(100);
    } else {
      setLoadedPhotos([]);
    }
  }, [photos]);

  // Enhanced virtualized scrolling with performance optimization
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Load more photos when user scrolls to 80% of current content
    if (scrollPercentage > 0.8 && Array.isArray(photos) && visibleRange.end < photos.length) {
      const newEnd = Math.min(visibleRange.end + 6, photos.length);
      setVisibleRange(prev => ({
        ...prev,
        end: newEnd
      }));
      
      // Preload next batch of images as thumbnails
      const nextBatch = photos.slice(visibleRange.end, newEnd);
      const nextImageSources = nextBatch.map(photo => getDisplayImageUrl(photo.url || '', true));
      imagePreloader.preloadBatch(nextImageSources, 5, 'medium');
    }
  }, [photos, visibleRange.end]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Use passive listener for better performance
    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Intersection observer for lazy loading visibility tracking
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const photoId = entry.target.getAttribute('data-photo-id');
            if (photoId) {
              // Photo is visible - ProgressiveImage will handle the actual loading
              // This observer is just for visibility tracking if needed
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

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

  const visiblePhotos = useMemo(() => {
    if (!Array.isArray(loadedPhotos)) {
      return [];
    }
    return loadedPhotos.slice(visibleRange.start, visibleRange.end);
  }, [loadedPhotos, visibleRange]);

  // Performance monitoring
  const renderStartTime = useRef<number>(0);
  useEffect(() => {
    renderStartTime.current = performance.now();
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      if (renderTime > 16) { // Log if render takes longer than 1 frame
        console.log(`Gallery render took ${renderTime.toFixed(2)}ms for ${visiblePhotos.length} photos`);
      }
    };
  }, [visiblePhotos.length]);

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
        <p className="text-lg font-medium">No photos available</p>
        <p className="text-sm">Photos will appear here once uploaded</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Multi-select toolbar */}
      {multiSelectMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {selectedPhotos.size} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllPhotos}
                disabled={selectedPhotos.size === photos.length}
              >
                Select All ({photos.length})
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDownload}
                disabled={selectedPhotos.size === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Download ({selectedPhotos.size})
              </Button>
              {canDelete && onDeletePhoto && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedPhotos.size === 0 || isDeletingSelected}
                >
                  {isDeletingSelected ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Delete ({selectedPhotos.size})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={exitMultiSelectMode}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className="max-h-[70vh] overflow-y-auto"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-1">
          {visiblePhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onLoad={() => handleImageLoad(photo.id)}
              onError={() => handleImageError(photo.id)}
              onPhotoClick={onPhotoClick}
              observer={observerRef.current}
              showSaveToProfile={showSaveToProfile}
              savedPhotoIds={savedPhotoIds}
              onSavePhoto={onSavePhoto}
              onRemovePhoto={onRemovePhoto}
              savingPhotoIds={savingPhotoIds}
              currentUser={currentUser}
              multiSelectMode={multiSelectMode}
              isSelected={selectedPhotos.has(photo.id)}
              onToggleSelection={() => togglePhotoSelection(photo.id)}
              onEnterMultiSelectMode={enterMultiSelectMode}
            />
          ))}
        </div>
      
        {/* Loading more indicator */}
        {visibleRange.end < photos.length && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
            <span className="ml-2 text-gray-600">Loading more photos...</span>
          </div>
        )}
        
        {/* Photos counter */}
        <div className="text-center py-4 text-sm text-gray-500">
          Showing {visibleRange.end} of {photos.length} photos
        </div>
      </div>
      
      {/* Single Download Progress Indicators */}
      <SingleDownloadProgress downloads={activeDownloads} />
    </div>
  );
};

interface PhotoCardProps {
  photo: PhotoWithLoading;
  onLoad: () => void;
  onError: () => void;
  onPhotoClick?: (photo: Photo) => void;
  observer: IntersectionObserver | null;
  showSaveToProfile?: boolean;
  savedPhotoIds?: string[];
  onSavePhoto?: (photoId: string) => void;
  onRemovePhoto?: (photoId: string) => void;
  savingPhotoIds?: string[];
  currentUser?: any;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onEnterMultiSelectMode?: () => void;
}

const PhotoCard = ({ 
  photo, 
  onLoad, 
  onError, 
  onPhotoClick, 
  observer, 
  showSaveToProfile = false, 
  savedPhotoIds = [], 
  onSavePhoto, 
  onRemovePhoto, 
  savingPhotoIds = [], 
  currentUser,
  multiSelectMode = false,
  isSelected = false,
  onToggleSelection,
  onEnterMultiSelectMode
}: PhotoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);
  const [isPressed, setIsPressed] = useState(false);

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

  // Long press / click hold detection handlers
  const startLongPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (multiSelectMode) return; // Don't start long press if already in multi-select mode
    
    suppressNextClickRef.current = false;
    setIsPressed(true);
    longPressTimerRef.current = setTimeout(() => {
      // Enter multi-select mode after 2 seconds
      suppressNextClickRef.current = true;
      onEnterMultiSelectMode?.();
      onToggleSelection?.();
      setIsPressed(false);
    }, 2000);
  }, [multiSelectMode, onEnterMultiSelectMode, onToggleSelection]);

  const cancelLongPress = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressed(false);
    
    // If long press was triggered, prevent the default click behavior
    if (suppressNextClickRef.current && e) {
      e.preventDefault();
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Handle card click based on mode
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Prevent double-toggle after long press
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    
    if (multiSelectMode) {
      // In multi-select mode, toggle selection
      e.preventDefault();
      e.stopPropagation();
      onToggleSelection?.();
    } else {
      // Normal mode, open photo
      onPhotoClick?.(photo);
    }
  }, [multiSelectMode, onToggleSelection, onPhotoClick, photo]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalUrl = getDownloadImageUrl(photo.url);
    const filename = photo.filename || `photo-${photo.id}.jpg`;
    
    // Use the new download system with progress
    await downloadPhoto(photo.id, originalUrl, filename);
  };

  const handleSaveToProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSavePhoto) {
      onSavePhoto(photo.id);
    }
  };

  const handleRemoveFromProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemovePhoto) {
      onRemovePhoto(photo.id);
    }
  };

  const isPhotoSaved = savedPhotoIds.includes(photo.id);
  const isPhotoSaving = savingPhotoIds.includes(photo.id);
  const canShowSaveButton = showSaveToProfile;

  return (
    <div
      ref={cardRef}
      data-photo-id={photo.id}
      className={`aspect-square relative group overflow-hidden rounded-lg bg-gray-100 cursor-pointer transform transition-all duration-200 ${
        multiSelectMode 
          ? isSelected 
            ? 'ring-4 ring-blue-500 scale-95' 
            : 'hover:ring-2 hover:ring-blue-300'
          : 'hover:scale-105 hover:shadow-lg'
      } ${isPressed ? 'scale-95 ring-2 ring-blue-400' : ''}`}
      onClick={handleCardClick}
      onMouseDown={startLongPress}
      onMouseUp={(e) => cancelLongPress(e)}
      onMouseLeave={(e) => cancelLongPress(e)}
      onTouchStart={startLongPress}
      onTouchEnd={(e) => cancelLongPress(e)}
      onTouchCancel={(e) => cancelLongPress(e)}
    >
      {/* Loading skeleton */}
      {!photo.loaded && !photo.error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-pulse" 
               style={{ animationDuration: '2s' }} />
        </div>
      )}
      
      {/* Error state */}
      {photo.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      
      {/* Progressive Image with optimized loading */}
      <ProgressiveImage
        src={photo.url}
        alt={photo.filename || 'Photo'}
        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
        priority="low"
        aspectRatio={1}
        onLoad={onLoad}
        onError={onError}
        loading="lazy"
        blur={false}
      />
      
      {/* Multi-select checkbox overlay */}
      {multiSelectMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
            isSelected 
              ? 'bg-blue-500 border-blue-500' 
              : 'bg-white/80 border-gray-300 hover:border-blue-400'
          }`}>
            {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
          </div>
        </div>
      )}
      
      {/* Hover overlay - hidden in multi-select mode */}
      {!multiSelectMode && (
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/90 hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                onPhotoClick?.(photo);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/90 hover:bg-white"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
            {canShowSaveButton && (
              <Button
                variant="secondary"
                size="sm"
                className={`bg-white/90 hover:bg-white ${isPhotoSaved ? 'text-red-500' : 'text-green-500'}`}
                onClick={isPhotoSaved ? handleRemoveFromProfile : handleSaveToProfile}
                disabled={isPhotoSaving}
              >
                {isPhotoSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPhotoSaved ? (
                  <HeartOff className="h-4 w-4" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
              </Button>
            )}
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

export default OptimizedPhotoGallery;