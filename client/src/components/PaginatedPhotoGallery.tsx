import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Download, Heart, HeartOff, Loader2, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import ProgressiveImage from './ProgressiveImage';
import { Photo } from '@shared/types';
import { useAuth } from '@/contexts/AuthContext';

// Hook to get responsive photos per page
const useResponsivePhotosPerPage = () => {
  const [photosPerPage, setPhotosPerPage] = useState(20);

  useEffect(() => {
    const updatePhotosPerPage = () => {
      const width = window.innerWidth;
      
      if (width < 640) {
        // Mobile: 10 photos per page
        setPhotosPerPage(10);
      } else if (width < 768) {
        // Small tablet: 15 photos per page
        setPhotosPerPage(15);
      } else if (width < 1024) {
        // Tablet: 20 photos per page
        setPhotosPerPage(20);
      } else if (width < 1280) {
        // Desktop: 30 photos per page
        setPhotosPerPage(30);
      } else {
        // Large desktop: 40 photos per page
        setPhotosPerPage(40);
      }
    };

    // Initial calculation
    updatePhotosPerPage();

    // Add event listener for window resize
    window.addEventListener('resize', updatePhotosPerPage);

    return () => {
      window.removeEventListener('resize', updatePhotosPerPage);
    };
  }, []);

  return photosPerPage;
};

interface PaginatedPhotoGalleryProps {
  photos: Photo[];
  loading?: boolean;
  onPhotoClick?: (photo: Photo) => void;
  className?: string;
  showSaveToProfile?: boolean;
  savedPhotoIds?: string[];
  onSavePhoto?: (photoId: string) => void;
  onRemovePhoto?: (photoId: string) => void;
  savingPhotoIds?: string[];
  photosPerPage?: number;
}

const PaginatedPhotoGallery: React.FC<PaginatedPhotoGalleryProps> = ({
  photos,
  loading = false,
  onPhotoClick,
  className = '',
  showSaveToProfile = false,
  savedPhotoIds = [],
  onSavePhoto,
  onRemovePhoto,
  savingPhotoIds = [],
  photosPerPage: propPhotosPerPage
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set());
  const [errorPhotos, setErrorPhotos] = useState<Set<string>>(new Set());
  const { currentUser } = useAuth();
  
  // Use responsive photos per page, but allow override via props
  const responsivePhotosPerPage = useResponsivePhotosPerPage();
  const photosPerPage = propPhotosPerPage || responsivePhotosPerPage;

  // Calculate pagination - memoized to prevent infinite loops
  const currentPhotos = useMemo(() => {
    const startIndex = (currentPage - 1) * photosPerPage;
    const endIndex = startIndex + photosPerPage;
    return photos.slice(startIndex, endIndex);
  }, [photos, currentPage, photosPerPage]);

  const totalPages = Math.ceil(photos.length / photosPerPage);
  const startIndex = (currentPage - 1) * photosPerPage;
  const endIndex = startIndex + photosPerPage;

  // Reset to first page when photos change or photos per page changes
  useEffect(() => {
    setCurrentPage(1);
    setLoadedPhotos(new Set());
    setErrorPhotos(new Set());
  }, [photos, photosPerPage]);

  const handlePhotoLoad = (photoId: string, photoIndex: number) => {
    setLoadedPhotos(prev => new Set(prev).add(photoId));
  };

  const handlePhotoError = (photoId: string, photoIndex: number) => {
    setErrorPhotos(prev => new Set(prev).add(photoId));
  };

  // For now, make all photos visible immediately to fix the issue
  // We'll improve ordering later
  const [revealedPhotos, setRevealedPhotos] = useState<Set<string>>(new Set());
  
  // Make all current photos visible immediately
  useEffect(() => {
    setRevealedPhotos(new Set(currentPhotos.map(photo => photo.id)));
  }, [currentPhotos]);

  const handleDownload = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${photo.url}?download=true`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.filename || 'photo';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  const scrollToTop = () => {
    // Immediate scroll to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Then apply smooth scroll for better UX
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 100);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      scrollToTop();
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      scrollToTop();
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      scrollToTop();
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
          {[...Array(photosPerPage)].map((_, index) => (
            <Card key={index} className="aspect-square overflow-hidden animate-pulse">
              <CardContent className="p-0 h-full bg-gray-200">
                <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className={`${className} text-center py-12`}>
        <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">No photos available</p>
      </div>
    );
  }

  return (
    <div className={`${className}`} data-gallery-container>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4 mb-4 md:mb-6">
        {currentPhotos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onPhotoClick={onPhotoClick}
            onDownload={handleDownload}
            onLoad={() => handlePhotoLoad(photo.id, index)}
            onError={() => handlePhotoError(photo.id, index)}
            loaded={loadedPhotos.has(photo.id)}
            error={errorPhotos.has(photo.id)}
            visible={revealedPhotos.has(photo.id)}
            showSaveToProfile={showSaveToProfile}
            savedPhotoIds={savedPhotoIds}
            onSavePhoto={onSavePhoto}
            onRemovePhoto={onRemovePhoto}
            savingPhotoIds={savingPhotoIds}
            currentUser={currentUser}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 md:gap-2 mt-6 md:mt-8">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2 md:px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[50vw] md:max-w-none">
            {/* First page */}
            {currentPage > 3 && (
              <>
                <Button
                  variant={1 === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(1)}
                  className="w-8 h-8 md:w-10 md:h-10 p-0 text-sm md:text-base flex-shrink-0"
                >
                  1
                </Button>
                {currentPage > 4 && <span className="px-1 md:px-2 text-sm">...</span>}
              </>
            )}

            {/* Current page and surrounding pages */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              if (pageNum < 1 || pageNum > totalPages) return null;

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(pageNum)}
                  className="w-8 h-8 md:w-10 md:h-10 p-0 text-sm md:text-base flex-shrink-0"
                >
                  {pageNum}
                </Button>
              );
            })}

            {/* Last page */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-1 md:px-2 text-sm">...</span>}
                <Button
                  variant={totalPages === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  className="w-8 h-8 md:w-10 md:h-10 p-0 text-sm md:text-base flex-shrink-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-2 md:px-3"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Page Info */}
      <div className="text-center text-xs md:text-sm text-gray-500 mt-3 md:mt-4 px-2">
        Showing {startIndex + 1}-{Math.min(endIndex, photos.length)} of {photos.length} photos
        {totalPages > 1 && (
          <span className="block sm:inline">
            <span className="hidden sm:inline"> • </span>
            Page {currentPage} of {totalPages}
          </span>
        )}
        <span className="block sm:inline text-xs opacity-75">
          <span className="hidden sm:inline"> • </span>
          {photosPerPage} per page
        </span>
      </div>
    </div>
  );
};

// Photo Card Component
interface PhotoCardProps {
  photo: Photo;
  onPhotoClick?: (photo: Photo) => void;
  onDownload: (photo: Photo, e: React.MouseEvent) => void;
  onLoad: () => void;
  onError: () => void;
  loaded: boolean;
  error: boolean;
  visible: boolean;
  showSaveToProfile: boolean;
  savedPhotoIds: string[];
  onSavePhoto?: (photoId: string) => void;
  onRemovePhoto?: (photoId: string) => void;
  savingPhotoIds: string[];
  currentUser: any;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onPhotoClick,
  onDownload,
  onLoad,
  onError,
  loaded,
  error,
  visible,
  showSaveToProfile,
  savedPhotoIds,
  onSavePhoto,
  onRemovePhoto,
  savingPhotoIds,
  currentUser
}) => {
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
  const canShowSaveButton = showSaveToProfile && currentUser;

  return (
    <Card className={`group hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden cursor-pointer ${
      visible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
    } transition-all duration-500`}>
      <CardContent className="p-0 aspect-square relative">
        {/* Loading skeleton */}
        {!loaded && !error && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-pulse" 
                 style={{ animationDuration: '2s' }} />
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        )}
        
        {/* Progressive Image with optimized loading */}
        <ProgressiveImage
          src={photo.url}
          thumbnailSrc={photo.thumbnailUrl} // Use pre-generated thumbnail URL
          alt={photo.filename || 'Photo'}
          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
          priority="high"
          aspectRatio={1}
          onLoad={onLoad}
          onError={onError}
          loading="lazy"
        />
        
        {/* Hover overlay - Mobile friendly */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 md:transition-all md:duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 touch-manipulation"
          onClick={(e) => {
            // On mobile, first tap shows overlay, second tap opens photo
            if (window.innerWidth <= 768) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div className="flex space-x-1 md:space-x-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/90 hover:bg-white p-2 md:p-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Eye icon clicked for photo:', photo.id);
                // Use setTimeout to ensure the event is processed after the current stack
                setTimeout(() => {
                  onPhotoClick?.(photo);
                }, 0);
              }}
            >
              <Eye className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/90 hover:bg-white p-2 md:p-2"
              onClick={(e) => onDownload(photo, e)}
            >
              <Download className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            {canShowSaveButton && (
              <Button
                variant="secondary"
                size="sm"
                className={`bg-white/90 hover:bg-white p-2 md:p-2 ${isPhotoSaved ? 'text-red-500' : 'text-green-500'}`}
                onClick={isPhotoSaved ? handleRemoveFromProfile : handleSaveToProfile}
                disabled={isPhotoSaving}
              >
                {isPhotoSaving ? (
                  <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                ) : isPhotoSaved ? (
                  <HeartOff className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Heart className="h-3 w-3 md:h-4 md:w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Loading indicator for individual photos */}
        {!loaded && !error && (
          <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1">
            <Loader2 className="h-3 w-3 animate-spin text-white" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaginatedPhotoGallery;