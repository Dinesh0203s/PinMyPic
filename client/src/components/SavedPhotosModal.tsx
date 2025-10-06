import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Download, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Photo } from '@shared/types';
import JSZip from 'jszip';
import { SimpleFullscreenViewer } from '@/components/SimpleFullscreenViewer';

interface SavedPhotosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SavedPhotosModal = ({ open, onOpenChange }: SavedPhotosModalProps) => {
  const { currentUser } = useAuth();
  const [fullScreenImage, setFullScreenImage] = useState<Photo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const photosPerPage = 30;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: photos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ['/api/user/saved-photos'],
    queryFn: async () => {
      if (!currentUser) return [];
      
      // Force refresh token to ensure it's valid
      const token = await currentUser.getIdToken(true);
      const response = await fetch('/api/user/saved-photos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch saved photos');
      }
      
      return response.json();
    },
    enabled: !!currentUser && open
  });

  const handleRemovePhoto = async (photoId: string) => {
    try {
      if (!currentUser) throw new Error('No user logged in');
      
      const token = await currentUser.getIdToken(true);
      const response = await fetch(`/api/photos/${photoId}/unsave`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to remove photo');
      }
      
      // Invalidate the saved photos query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/user/saved-photos'] });
      
      toast({
        title: "Photo removed",
        description: "Photo has been removed from your saved collection."
      });
      
    } catch (error) {
      console.error('Error removing photo:', error);
      toast({
        title: "Error",
        description: "Failed to remove photo from saved collection.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) {
      toast({
        title: "No Photos",
        description: "You don't have any saved photos to download.",
        variant: "destructive"
      });
      return;
    }

    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      let downloadCount = 0;
      let errorCount = 0;
      
      // Show initial progress
      toast({
        title: "Starting Download",
        description: `Preparing ${photos.length} saved photos for download...`
      });

      // Batch download with concurrency limit for better performance
      const BATCH_SIZE = 5; // Download 5 photos at a time
      const batches = [];
      
      for (let i = 0; i < photos.length; i += BATCH_SIZE) {
        batches.push(photos.slice(i, i + BATCH_SIZE));
      }

      // Process batches sequentially but photos within batch concurrently
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const batchPromises = batch.map(async (photo, index) => {
          try {
            const downloadUrl = photo.url.includes('/api/images/') 
              ? `${photo.url}?download=true` // Original quality for downloads
              : photo.url;
            
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${photo.filename}`);
            
            const blob = await response.blob();
            const extension = photo.filename.split('.').pop() || 'jpg';
            const safeFilename = `photo_${downloadCount + index + 1}.${extension}`;
            zip.file(safeFilename, blob);
            
            downloadCount++;
          } catch (error) {
            console.error(`Error downloading photo ${photo.filename}:`, error);
            errorCount++;
          }
        });
        
        await Promise.all(batchPromises);
        
        // Update progress toast
        const processedCount = (batchIndex + 1) * BATCH_SIZE;
        const remaining = Math.max(0, photos.length - processedCount);
        
        if (batchIndex < batches.length - 1) {
          toast({
            title: "Downloading...",
            description: `Downloaded ${Math.min(processedCount, photos.length)} of ${photos.length} photos. ${remaining} remaining...`
          });
        }
      }

      if (downloadCount === 0) {
        throw new Error('Failed to download any photos');
      }

      // Generate and download the zip file
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = url;
      link.download = `saved-photos-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show completion message
      const successMessage = errorCount === 0 
        ? `Successfully downloaded all ${downloadCount} photos!`
        : `Downloaded ${downloadCount} photos. ${errorCount} failed to download.`;
      
      toast({
        title: "Download Complete",
        description: successMessage,
        variant: errorCount === 0 ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Error downloading photos:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download photos.",
        variant: "destructive"
      });
    } finally {
      setDownloadingAll(false);
    }
  };

  const handlePhotoClick = (photo: Photo, index: number) => {
    setFullScreenImage(photo);
    setCurrentPhotoIndex(index);
  };

  const handleFullscreenNavigation = (direction: 'prev' | 'next') => {
    if (!photos.length) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentPhotoIndex + 1) % photos.length;
    } else {
      newIndex = (currentPhotoIndex - 1 + photos.length) % photos.length;
    }
    
    setCurrentPhotoIndex(newIndex);
    setFullScreenImage(photos[newIndex]);
  };

  // Calculate pagination
  const totalPages = Math.ceil(photos.length / photosPerPage);
  const paginatedPhotos = photos.slice(
    (currentPage - 1) * photosPerPage,
    currentPage * photosPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (photosLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My Saved Photos</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>My Saved Photos</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Your collection of favorite photos
                </p>
              </div>
              {photos.length > 0 && (
                <Button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white"
                >
                  {downloadingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download All ({photos.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="mt-6">
            {photos.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved photos yet</h3>
                <p className="text-gray-600">
                  Save your favorite photos from events to see them here.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {photos.length} photos saved • Showing {paginatedPhotos.length} photos on page {currentPage}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {paginatedPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="relative group cursor-pointer"
                      onClick={() => handlePhotoClick(photo, (currentPage - 1) * photosPerPage + index)}
                    >
                      <div className="aspect-square overflow-hidden rounded-lg">
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt={`Saved photo ${index + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(photo.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove from saved"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
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
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {fullScreenImage && (
        <SimpleFullscreenViewer
          photo={fullScreenImage}
          photos={photos}
          currentIndex={currentPhotoIndex}
          onClose={() => setFullScreenImage(null)}
          onNext={currentPhotoIndex < photos.length - 1 ? () => handleFullscreenNavigation('next') : undefined}
          onPrevious={currentPhotoIndex > 0 ? () => handleFullscreenNavigation('prev') : undefined}
          onIndexChange={(index) => {
            setCurrentPhotoIndex(index);
            setFullScreenImage(photos[index]);
          }}
          onRemovePhoto={handleRemovePhoto}
        />
      )}
    </>
  );
};

export default SavedPhotosModal;