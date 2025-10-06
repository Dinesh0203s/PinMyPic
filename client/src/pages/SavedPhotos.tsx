import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Download, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Photo } from '@shared/types';
import JSZip from 'jszip';
import { SimpleFullscreenViewer } from '@/components/SimpleFullscreenViewer';
import PaginatedPhotoGallery from '@/components/PaginatedPhotoGallery';
import Header from '@/components/Header';

const SavedPhotos = () => {
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { currentUser } = useAuth();
  const [fullScreenImage, setFullScreenImage] = useState<Photo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [downloadingAll, setDownloadingAll] = useState(false);
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
    enabled: !!currentUser
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
    
    // Determine batch size based on total photos
    const batchSize = photos.length < 500 ? 50 : 100;
    const totalBatches = Math.ceil(photos.length / batchSize);
    
      toast({
      title: "Preparing Downloads",
      description: `Creating ${totalBatches} ZIP files with ${batchSize} photos each...`
    });

    try {
      // Process photos in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, photos.length);
        const batchPhotos = photos.slice(startIndex, endIndex);
        
        // Create ZIP for this batch
        const zip = new JSZip();
        let successCount = 0;
        let errorCount = 0;
        
        // Download photos in this batch
        for (let i = 0; i < batchPhotos.length; i++) {
          const photo = batchPhotos[i];
          try {
            const downloadUrl = photo.url.includes('/api/images/') 
              ? `${photo.url}?download=true&quality=85`
              : photo.url;
            
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${photo.filename}`);
            
            const blob = await response.blob();
            const extension = photo.filename?.split('.').pop() || 'jpg';
            const safeFilename = `saved_photo_${startIndex + i + 1}.${extension}`;
            zip.file(`Saved Photos/${safeFilename}`, blob);
            successCount++;
            
            // Update progress
            const progress = Math.round(((batchIndex * batchSize) + i + 1) / photos.length * 100);
            toast({
              title: "Downloading Saved Photos",
              description: `Batch ${batchIndex + 1}/${totalBatches}: ${progress}% complete`
            });
            
          } catch (error) {
            console.error(`Error downloading photo ${photo.filename}:`, error);
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          // Generate and download ZIP for this batch
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 }, // Faster compression
            streamFiles: true
      });

          // Create download link with better browser compatibility
          const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
          link.download = `saved_photos_batch_${batchIndex + 1}_of_${totalBatches}.zip`;
          link.style.display = 'none';
      document.body.appendChild(link);
          
          // Trigger download with better error handling
          try {
      link.click();
            console.log(`Downloaded saved photos batch ${batchIndex + 1} of ${totalBatches}`);
          } catch (error) {
            console.error('Download failed:', error);
            // Fallback: open in new window
            window.open(url, '_blank');
          }
          
          // Cleanup with delay to ensure download starts
          setTimeout(() => {
            URL.revokeObjectURL(url);
            if (document.body.contains(link)) {
              document.body.removeChild(link);
            }
          }, 1000);
        }
        
        // Small delay between batches to prevent overwhelming the server
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Final success message
      toast({
        title: "Download Complete",
        description: `Successfully created ${totalBatches} ZIP files with ${photos.length} saved photos total.`
      });

    } catch (error) {
      console.error('Error creating zip file:', error);
      toast({
        title: "Download Failed",
        description: "An error occurred while creating the ZIP file.",
        variant: "destructive"
      });
    } finally {
      setDownloadingAll(false);
    }
  };

  const openFullScreen = (photo: Photo) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setFullScreenImage(photo);
    setCurrentPhotoIndex(index);
  };

  const closeFullScreen = () => {
    setFullScreenImage(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      const newIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1;
      setCurrentPhotoIndex(newIndex);
      setFullScreenImage(photos[newIndex]);
    } else {
      const newIndex = currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0;
      setCurrentPhotoIndex(newIndex);
      setFullScreenImage(photos[newIndex]);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <Card className="w-full max-w-md mx-4">
            <CardContent className="text-center p-6">
              <Heart className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">Please Sign In</h2>
              <p className="text-gray-600">You need to be signed in to view your saved photos.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Saved Photos</h1>
          <p className="text-gray-600">Your collection of favorite photos</p>
        </div>

        {photosLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
            <span className="ml-2 text-gray-600">Loading your saved photos...</span>
          </div>
        ) : photos.length === 0 ? (
          <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="text-center py-12">
              <Heart className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2 text-gray-900">No Saved Photos Yet</h2>
              <p className="text-gray-600 mb-4">
                Start exploring events and save photos you love to see them here.
              </p>
              <Button 
                onClick={() => window.location.href = '/events'}
                className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white"
              >
                Browse Events
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Download All Button */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">{photos.length} photos saved</p>
              </div>
              <Button
                onClick={handleDownloadAll}
                disabled={downloadingAll || photos.length === 0}
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
            </div>

            {/* Photos Gallery */}
            <PaginatedPhotoGallery
              photos={photos}
              onPhotoClick={openFullScreen}
              savedPhotoIds={photos.map(p => p.id)} // All photos are saved in this context
              onSavePhoto={() => {}} // No save functionality needed here
              onRemovePhoto={handleRemovePhoto}
            />
          </div>
        )}

        {/* Full Screen Photo Viewer */}
        {fullScreenImage && (
          <SimpleFullscreenViewer
            photo={fullScreenImage}
            photos={photos}
            currentIndex={currentPhotoIndex}
            onClose={closeFullScreen}
            onPrevious={() => navigatePhoto('prev')}
            onNext={() => navigatePhoto('next')}
            savedPhotoIds={photos.map(p => p.id)}
            onSavePhoto={async () => {}} // No save functionality needed here
            onRemovePhoto={handleRemovePhoto}
            savingPhotoIds={[]}
          />
        )}
      </div>
    </div>
  );
};

export default SavedPhotos;