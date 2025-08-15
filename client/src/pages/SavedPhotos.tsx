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
              ? `${photo.url}?download=true&quality=85` // Reduced quality for faster download
              : photo.url;
            
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${photo.filename}`);
            
            const blob = await response.blob();
            const filename = photo.filename || `saved_photo_${batchIndex * BATCH_SIZE + index + 1}.jpg`;
            
            // Add to zip in "Saved Photos" folder
            zip.file(`Saved Photos/${filename}`, blob);
            downloadCount++;
            
            return true;
          } catch (error) {
            console.error(`Error downloading photo ${photo.filename}:`, error);
            errorCount++;
            return false;
          }
        });

        // Wait for current batch to complete
        await Promise.all(batchPromises);
        
        // Update progress after each batch
        toast({
          title: "Download Progress",
          description: `Downloaded ${downloadCount} of ${photos.length} photos...`
        });
        
        // Small delay between batches to prevent overwhelming the server
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (downloadCount === 0) {
        toast({
          title: "Download Failed",
          description: "Unable to download any photos. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Generate and download zip file with faster compression
      toast({
        title: "Creating ZIP File",
        description: "Compressing photos into ZIP file..."
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 }, // Faster compression
        streamFiles: true // Use streaming for better memory management
      });

      // Create download link
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'saved_photos.zip';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      // Show success message
      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${downloadCount} saved photos${errorCount > 0 ? ` (${errorCount} failed)` : ''}.`
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