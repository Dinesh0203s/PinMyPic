import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ChevronLeft, ChevronRight, ImageIcon, Download, CheckSquare, Square } from 'lucide-react';
import ProgressiveImage from './ProgressiveImage';
import { Photo } from '@shared/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getDownloadImageUrl } from '@/utils/imagePreloader';

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
  enableSelection?: boolean;
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
  photosPerPage: propPhotosPerPage,
  enableSelection = false
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set());
  const [errorPhotos, setErrorPhotos] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
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

  // Selection handlers
  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(photoId)) {
        newSelection.delete(photoId);
      } else {
        newSelection.add(photoId);
      }
      return newSelection;
    });
  }, []);

  const selectAllCurrentPage = useCallback(() => {
    const currentPagePhotoIds = currentPhotos.map(photo => photo.id);
    setSelectedPhotos(prev => {
      const newSelection = new Set(prev);
      currentPagePhotoIds.forEach(id => newSelection.add(id));
      return newSelection;
    });
  }, [currentPhotos]);

  const clearSelection = useCallback(() => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        clearSelection();
      }
      return !prev;
    });
  }, [clearSelection]);

  // Download handlers
  const downloadSelectedPhotos = useCallback(async () => {
    if (selectedPhotos.size === 0) {
      console.log('No photos selected');
      return;
    }

    const selectedPhotoList = photos.filter(photo => selectedPhotos.has(photo.id));
    console.log('Selected photos for download:', selectedPhotoList.length, selectedPhotoList);
    
    toast({
      title: "Preparing Download",
      description: `Preparing ${selectedPhotoList.length} photos for download...`
    });

    try {
      // Create ZIP file directly
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      let successCount = 0;
      let errorCount = 0;

      // Download photos in batches to avoid overwhelming the server
      const BATCH_SIZE = 5;
      const batches = [];
      for (let i = 0; i < selectedPhotoList.length; i += BATCH_SIZE) {
        batches.push(selectedPhotoList.slice(i, i + BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const batchPromises = batch.map(async (photo, index) => {
          try {
            const downloadUrl = getDownloadImageUrl(photo.url);
            console.log(`Downloading photo ${index + 1} in batch ${batchIndex + 1}:`, photo.filename, downloadUrl);
            
            const response = await fetch(downloadUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch ${photo.filename}: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const filename = photo.filename || `photo_${batchIndex * BATCH_SIZE + index + 1}.jpg`;
            
            console.log(`Successfully downloaded: ${filename}, size: ${blob.size} bytes`);
            
            // Add to zip
            zip.file(filename, blob);
            successCount++;
            
            return true;
          } catch (error) {
            console.error(`Error downloading photo ${photo.filename}:`, error);
            errorCount++;
            return false;
          }
        });

        // Wait for current batch to complete
        await Promise.all(batchPromises);
        
        // Update progress
        const processedCount = (batchIndex + 1) * BATCH_SIZE;
        const totalProcessed = Math.min(processedCount, selectedPhotoList.length);
        
        toast({
          title: "Downloading Photos",
          description: `Downloaded ${totalProcessed} of ${selectedPhotoList.length} photos...`
        });
        
        // Small delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (successCount === 0) {
        throw new Error('Failed to download any photos');
      }

      // Generate and download zip file
      toast({
        title: "Creating ZIP File",
        description: "Compressing photos into ZIP file..."
      });

      console.log(`Creating ZIP with ${successCount} photos`);
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      console.log(`ZIP created, size: ${zipBlob.size} bytes`);

      // Download ZIP
      const filename = `selected-photos-${new Date().toISOString().split('T')[0]}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      console.log(`Triggering download: ${filename}`);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: `${successCount} photos downloaded successfully${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
      });

      clearSelection();
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "An error occurred during download",
        variant: "destructive"
      });
    }
  }, [selectedPhotos, photos, toast, clearSelection]);


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
      {/* Selection Controls */}
      {enableSelection && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={toggleSelectionMode}
                className="flex items-center gap-2"
              >
                {isSelectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {isSelectionMode ? "Exit Selection" : "Select Photos"}
              </Button>
              
              {isSelectionMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllCurrentPage}
                    className="flex items-center gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Select All on Page
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    className="flex items-center gap-2"
                  >
                    Clear Selection
                  </Button>
                </>
              )}
            </div>
            
            {isSelectionMode && selectedPhotos.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  onClick={downloadSelectedPhotos}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Selected
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4 mb-4 md:mb-6">
        {currentPhotos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onPhotoClick={onPhotoClick}
            onLoad={() => handlePhotoLoad(photo.id, index)}
            onError={() => handlePhotoError(photo.id, index)}
            loaded={loadedPhotos.has(photo.id)}
            error={errorPhotos.has(photo.id)}
            visible={revealedPhotos.has(photo.id)}
            isSelectionMode={isSelectionMode}
            isSelected={selectedPhotos.has(photo.id)}
            onToggleSelection={() => togglePhotoSelection(photo.id)}
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
  onLoad: () => void;
  onError: () => void;
  loaded: boolean;
  error: boolean;
  visible: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onPhotoClick,
  onLoad,
  onError,
  loaded,
  error,
  visible,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection
}) => {

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection();
    } else {
      onPhotoClick?.(photo);
    }
  };

  return (
    <Card 
      className={`group hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden cursor-pointer ${
        visible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
      } transition-all duration-500 ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      onClick={handleCardClick}
    >
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
          priority="low"
          aspectRatio={1}
          onLoad={onLoad}
          onError={onError}
          loading="lazy"
        />
        
        
        {/* Loading indicator for individual photos */}
        {!loaded && !error && (
          <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1">
            <Loader2 className="h-3 w-3 animate-spin text-white" />
          </div>
        )}

        {/* Selection checkbox overlay */}
        {isSelectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={isSelected}
              onChange={onToggleSelection}
              className="bg-white/90 border-2 border-white shadow-lg"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaginatedPhotoGallery;