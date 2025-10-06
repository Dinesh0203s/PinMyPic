
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Lock, Users, Camera, Search, MapPin, Eye, X, Upload, Scan, Download, Unlock, Video, VideoOff, ChevronLeft, ChevronRight, Share2, Copy, ExternalLink, Check, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PaginatedPhotoGallery from '@/components/PaginatedPhotoGallery';
import { SimpleFullscreenViewer } from '@/components/SimpleFullscreenViewer';
import { Event, Photo } from '@shared/types';
import { useDebounce } from '@/hooks/useDebounce';
import { getDownloadImageUrl } from '@/utils/imagePreloader';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import DownloadProgressModal from '@/components/DownloadProgressModal';

const Events = () => {
  const { eventId: urlEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [eventsPerPage] = useState(12);
  const [sortBy, setSortBy] = useState('eventDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPage: number | null;
    prevPage: number | null;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [faceScanDialogOpen, setFaceScanDialogOpen] = useState(false);
  const [directEventAccess, setDirectEventAccess] = useState<Event | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const [showInlineGallery, setShowInlineGallery] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploadedFace, setUploadedFace] = useState<File | null>(null);
  const [scanningFace, setScanningFace] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<Photo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  // Download manager
  const downloadManager = useDownloadManager({ maxConcurrent: 6 });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  // Removed upload mode - only camera mode available
  
  // Save to Profile functionality
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([]);
  const [savingPhotoIds, setSavingPhotoIds] = useState<string[]>([]);
  const [activeAuthToast, setActiveAuthToast] = useState<{ dismiss: () => void } | null>(null);
  const [hasShownFirstTimeSaveToast, setHasShownFirstTimeSaveToast] = useState(false);
  
  // Share functionality
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEvent, setShareEvent] = useState<Event | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  // Download all functionality - now handled by download manager
  
  // Removed upload photo search - only selfie mode available
  
  const { currentUser, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Listen for auth success to dismiss auth toasts
  useEffect(() => {
    const handleAuthSuccess = () => {
      if (activeAuthToast) {
        activeAuthToast.dismiss();
        setActiveAuthToast(null);
      }
    };
    
    window.addEventListener('authSuccess', handleAuthSuccess);
    return () => window.removeEventListener('authSuccess', handleAuthSuccess);
  }, [activeAuthToast]);

  // Load first-time toast state from localStorage
  useEffect(() => {
    const hasShownToast = localStorage.getItem('hasShownFirstTimeSaveToast') === 'true';
    setHasShownFirstTimeSaveToast(hasShownToast);
  }, []);

  // Share URL generation function
  const generateShareUrl = async (event: Event) => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to share events.",
        variant: "destructive"
      });
      return;
    }
    
    setGeneratingUrl(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/events/${event.id}/share-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setShareUrl(data.shareUrl);
        setShareEvent(event);
        setShareDialogOpen(true);
        toast({
          title: "Share URL Generated",
          description: "The shareable URL has been created successfully."
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate share URL. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating share URL:', error);
      toast({
        title: "Error",
        description: "An error occurred while generating the share URL.",
        variant: "destructive"
      });
    } finally {
      setGeneratingUrl(false);
    }
  };

  // Copy URL to clipboard
  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      toast({
        title: "URL Copied",
        description: "The share URL has been copied to your clipboard."
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive"
      });
    }
  };

  // Open URL in new tab
  const openShareUrl = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };


  // Download all photos with batch-wise ZIP creation
  const downloadAllPhotos = async () => {
    if (photos.length === 0) {
      toast({
        title: "No Photos",
        description: "There are no photos to download.",
        variant: "destructive"
      });
      return;
    }

    const eventTitle = selectedEvent?.title || 'photos';
    const safeEventTitle = eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Determine batch size based on total photos
    const batchSize = photos.length < 500 ? 50 : 100;
    const totalBatches = Math.ceil(photos.length / batchSize);
    
    toast({
      title: "Preparing Downloads",
      description: `Creating ${totalBatches} ZIP files with ${batchSize} photos each...`
    });

    console.log(`Starting batch download: ${photos.length} photos, ${totalBatches} batches, ${batchSize} per batch`);

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
              ? `${photo.url}?download=true`
              : photo.url;
            
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${photo.filename}`);
            
            const blob = await response.blob();
            const extension = photo.filename?.split('.').pop() || 'jpg';
            const safeFilename = `photo_${startIndex + i + 1}.${extension}`;
            zip.file(safeFilename, blob);
            successCount++;
            
            // Update progress
            const progress = Math.round(((batchIndex * batchSize) + i + 1) / photos.length * 100);
            toast({
              title: "Downloading Photos",
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
          
          // Validate ZIP blob
          if (!zipBlob || zipBlob.size === 0) {
            console.error(`Empty ZIP blob for batch ${batchIndex + 1}`);
            continue;
          }
          
          console.log(`Generated ZIP for batch ${batchIndex + 1}: ${zipBlob.size} bytes`);
          
          // Create download link with better browser compatibility
          const url = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${safeEventTitle}_batch_${batchIndex + 1}_of_${totalBatches}.zip`;
          link.style.display = 'none';
          document.body.appendChild(link);
          
          // Trigger download with better error handling
          try {
            link.click();
            console.log(`Downloaded batch ${batchIndex + 1} of ${totalBatches}`);
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
        description: `Successfully created ${totalBatches} ZIP files with ${photos.length} photos total.`
      });
      
    } catch (error) {
      console.error('Error creating batch ZIP files:', error);
      toast({
        title: "Download Failed",
        description: "An error occurred while creating the ZIP files.",
        variant: "destructive"
      });
    }
  };

  // Navigation functions for slideshow
  const goToPreviousPhoto = () => {
    if (photos.length === 0) return;
    const newIndex = currentPhotoIndex === 0 ? photos.length - 1 : currentPhotoIndex - 1;
    setCurrentPhotoIndex(newIndex);
    setFullScreenImage(photos[newIndex]);
  };

  const goToNextPhoto = () => {
    if (photos.length === 0) return;
    const newIndex = currentPhotoIndex === photos.length - 1 ? 0 : currentPhotoIndex + 1;
    setCurrentPhotoIndex(newIndex);
    setFullScreenImage(photos[newIndex]);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!fullScreenImage) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousPhoto();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNextPhoto();
          break;
        case 'Escape':
          event.preventDefault();
          setFullScreenImage(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [fullScreenImage, currentPhotoIndex, photos]);

  // Update photo index when fullScreenImage changes
  useEffect(() => {
    if (fullScreenImage) {
      const index = photos.findIndex(photo => photo.id === fullScreenImage.id);
      if (index !== -1) {
        setCurrentPhotoIndex(index);
      }
    }
  }, [fullScreenImage, photos]);



  const fetchEvents = useCallback(async (page = 1, search = '', sort = sortBy, order = sortOrder) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: eventsPerPage.toString(),
        search: search.trim(),
        sortBy: sort,
        sortOrder: order
      });
      
      const response = await fetch(`/api/events/all?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.events && data.pagination) {
          // New paginated API response
          setEvents(data.events);
          setPagination(data.pagination);
          setCurrentPage(data.pagination.currentPage);
          setTotalPages(data.pagination.totalPages);
          setTotalEvents(data.pagination.totalEvents);
        } else {
          // Fallback for old API response format
          setEvents(Array.isArray(data) ? data : []);
          setCurrentPage(1);
          setTotalPages(1);
          setTotalEvents(Array.isArray(data) ? data.length : 0);
        }
      } else {
        // Fallback to admin endpoint if new endpoint doesn't exist yet
        const fallbackResponse = await fetch('/api/admin/events');
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          setEvents(data);
          setCurrentPage(1);
          setTotalPages(1);
          setTotalEvents(data.length);
        }
      }
      setHasInitialized(true);
    } catch (error) {
      console.error('Error fetching events:', error);
      setHasInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [eventsPerPage, sortBy, sortOrder]);

  useEffect(() => {
    // Check if we need direct access (URL or QR)
    const searchParams = new URLSearchParams(location.search);
    const qrEventId = searchParams.get('eventId');
    const autoScan = searchParams.get('autoScan') === 'true';
    
    if (urlEventId) {
      // URL-based event access - fetch only this event and show PIN dialog immediately
      fetchSingleEventForDirectAccess(urlEventId, 'url');
    } else if (qrEventId && autoScan) {
      // QR-based access - fetch only this event and show face scan dialog immediately  
      fetchSingleEventForDirectAccess(qrEventId, 'qr');
    } else {
      // Normal events page - fetch paginated events
      fetchEvents(currentPage, debouncedSearchTerm, sortBy, sortOrder);
    }
  }, [urlEventId, location.search, currentPage, debouncedSearchTerm, sortBy, sortOrder]);

  // Handle navigation back to events list - refresh data when returning from event details
  useEffect(() => {
    // Only fetch events if we're not in a direct access mode and events array is empty and not yet initialized
    if (!urlEventId && !location.search.includes('eventId') && events.length === 0 && !loading && !hasInitialized) {
      console.log('Refreshing events data after navigation');
      fetchEvents(currentPage, debouncedSearchTerm, sortBy, sortOrder);
    }
  }, [urlEventId, location.search, fetchEvents, currentPage, debouncedSearchTerm, sortBy, sortOrder, hasInitialized]);

  // Handle page focus - refresh data when user returns to the page
  useEffect(() => {
    const handlePageFocus = () => {
      // Only refresh if we're on the main events page and data is empty and not yet initialized
      if (!urlEventId && !location.search.includes('eventId') && events.length === 0 && !loading && !hasInitialized) {
        console.log('Page focused - refreshing events data');
        fetchEvents(currentPage, debouncedSearchTerm, sortBy, sortOrder);
      }
    };

    window.addEventListener('focus', handlePageFocus);
    return () => window.removeEventListener('focus', handlePageFocus);
  }, [urlEventId, location.search, fetchEvents, currentPage, debouncedSearchTerm, sortBy, sortOrder, hasInitialized]);

  // Fetch single event for direct access (URL or QR)
  const fetchSingleEventForDirectAccess = async (eventId: string, accessType: 'url' | 'qr') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}`);
      
      if (response.ok) {
        const event = await response.json();
        setDirectEventAccess(event);
        setSelectedEvent(event);
        setPin('');
        setPinError('');
        
        if (accessType === 'qr') {
          // QR access - immediately open face scan dialog
          setFaceScanDialogOpen(true);
          // Clear URL parameters to clean up the address bar
          const newUrl = new URL(window.location.href);
          newUrl.search = '';
          newUrl.hash = '';
          window.history.replaceState({}, '', newUrl.toString());
        } else if (accessType === 'url') {
          // URL access - show PIN dialog for private events, gallery for public events
          if (event.isPrivate) {
            setPinDialogOpen(true);
          } else {
            // Public event - directly load and show gallery
            loadEventPhotos(event.id).then(() => {
              setShowInlineGallery(true);
            });
          }
        }
      } else {
        toast({
          title: "Event Not Found",
          description: "The requested event could not be found.",
          variant: "destructive"
        });
        navigate('/events');
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({
        title: "Error",
        description: "Failed to load event. Please try again.",
        variant: "destructive"
      });
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  // Load saved photos when user is logged in
  useEffect(() => {
    if (currentUser) {
      loadSavedPhotos();
    }
  }, [currentUser]);

  const loadSavedPhotos = async () => {
    try {
      const token = await currentUser?.getIdToken(true);
      const response = await fetch('/api/user/saved-photos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const savedPhotos = await response.json();
        setSavedPhotoIds(savedPhotos.map((photo: Photo) => photo.id));
      }
    } catch (error) {
      console.error('Error loading saved photos:', error);
    }
  };

  const handleSavePhoto = async (photoId: string) => {
    if (!currentUser) {
      // Store current URL for redirect after login
      localStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      
      const toastResult = toast({
        title: "Sign In Required",
        description: "Please sign in to save photos to your profile.",
        action: (
          <Button
            onClick={() => loginWithGoogle()}
            className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign In
          </Button>
        ),
      });
      setActiveAuthToast(toastResult);
      return;
    }

    setSavingPhotoIds(prev => [...prev, photoId]);
    
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch('/api/user/save-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photoId })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Add to local state for immediate UI feedback
        setSavedPhotoIds(prev => [...prev, photoId]);
        
        // Invalidate the saved photos query to refresh the Profile page
        queryClient.invalidateQueries({ queryKey: ['/api/user/saved-photos'] });
        
        if (data.alreadySaved) {
          toast({
            title: "Photo Already Saved",
            description: "This photo was already in your saved photos.",
            duration: 2000,
          });
        } else {
          // Show detailed message only for the first save
          if (!hasShownFirstTimeSaveToast) {
            toast({
              title: "Photo Saved",
              description: "Photo saved to your profile. Note: Saved photos are temporary - download to keep permanently.",
              duration: 2000,
            });
            setHasShownFirstTimeSaveToast(true);
            localStorage.setItem('hasShownFirstTimeSaveToast', 'true');
          } else {
            // Show simple message for subsequent saves
            toast({
              title: "Photo Saved",
              description: "Photo saved to your profile.",
              duration: 2000,
            });
          }
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to save photo.",
          variant: "destructive",
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error saving photo:', error);
      toast({
        title: "Error",
        description: "An error occurred while saving the photo.",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setSavingPhotoIds(prev => prev.filter(id => id !== photoId));
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!currentUser) {
      // Store current URL for redirect after login
      localStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      
      const toastResult = toast({
        title: "Sign In Required",
        description: "Please sign in to manage your saved photos.",
        action: (
          <Button
            onClick={() => loginWithGoogle()}
            className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign In
          </Button>
        ),
      });
      setActiveAuthToast(toastResult);
      return;
    }

    setSavingPhotoIds(prev => [...prev, photoId]);
    
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch('/api/user/remove-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photoId })
      });
      
      if (response.ok) {
        setSavedPhotoIds(prev => prev.filter(id => id !== photoId));
        
        // Invalidate the saved photos query to refresh the Profile page
        queryClient.invalidateQueries({ queryKey: ['/api/user/saved-photos'] });
        
        toast({
          title: "Photo Removed",
          description: "Photo has been removed from your profile.",
          duration: 2000,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to remove photo.",
          variant: "destructive",
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error removing photo:', error);
      toast({
        title: "Error",
        description: "An error occurred while removing the photo.",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setSavingPhotoIds(prev => prev.filter(id => id !== photoId));
    }
  };

  // Handle auto-opening selected event from homepage navigation
  useEffect(() => {
    if (events.length > 0 && !loading) {
      const selectedEventId = sessionStorage.getItem('selectedEventId');
      if (selectedEventId) {
        const autoOpenEvent = events.find((event: Event) => event.id === selectedEventId);
        if (autoOpenEvent) {
          handleEventAccess(autoOpenEvent);
        }
        // Clear the stored event ID after use
        sessionStorage.removeItem('selectedEventId');
      }
    }
  }, [events, loading]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (newSortBy: string, newSortOrder: string = sortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const handleEventAccess = async (event: Event) => {
    setSelectedEvent(event);
    setPin('');
    setPinError('');
    setUploadedFace(null);
    setCapturedPhoto(null);
    
    if (event.isPrivate) {
      // Private events require PIN
      setPinDialogOpen(true);
    } else {
      // Public events - direct access to full gallery (no PIN, no face scan)
      await loadEventPhotos(event.id);
      setShowInlineGallery(true);
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedEvent || !pin.trim()) {
      setPinError('Please enter a PIN');
      return;
    }

    // Check which type of PIN was entered
    if (pin === selectedEvent.brideGroomPin) {
      // Bride-Groom PIN: Direct access to full gallery (no face scan)
      setPinDialogOpen(false);
      await loadEventPhotos(selectedEvent.id);
      setShowInlineGallery(true);
    } else if (pin === selectedEvent.publicPin) {
      // Public PIN: Requires face scan to show matched photos
      setPinDialogOpen(false);
      setFaceScanDialogOpen(true);
    } else {
      setPinError('Invalid PIN. Please try again.');
    }
  };

  const handleFaceScan = async () => {
    if (!uploadedFace || !selectedEvent) return;
    
    setScanningFace(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFace);
      });
      
      // Call face recognition API
      const response = await fetch('/api/face-recognition/find-my-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfieData: base64Data,
          eventId: selectedEvent.id
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if no face was detected
        if (data.noFaceDetected) {
          // Show informational message instead of error
          toast({
            title: data.guidance?.title || "No Face Detected",
            description: data.guidance?.message || "We couldn't detect a clear face in your photo. Please try again with a better photo.",
            duration: 5000,
          });
          
          // Show tips if available
          if (data.guidance?.tips && data.guidance.tips.length > 0) {
            setTimeout(() => {
              toast({
                title: "Tips for Better Photos",
                description: data.guidance.tips.join(" • "),
                duration: 8000,
              });
            }, 1000);
          }
          
          // Don't close the dialog - let user try again
          return;
        }
        
        // Show only matched photos (filtered by face recognition)
        setFaceScanDialogOpen(false);
        setPhotos(data.matchedPhotos || []);
        setShowInlineGallery(true);
      } else {
        console.error('Face recognition failed');
        // Show error message
        setPinError('Face recognition failed. Please try again.');
      }
    } catch (error) {
      console.error('Face scanning error:', error);
      setPinError('An error occurred during face scanning.');
    } finally {
      setScanningFace(false);
    }
  };

  const loadEventPhotos = async (eventId: string, page: number = 1) => {
    setLoadingPhotos(true);
    try {
      let allPhotos: Photo[] = [];
      let currentPage = 1;
      let hasMore = true;
      const limit = 500; // Fetch 500 photos per request
      
      // Fetch all photos by making multiple paginated requests
      while (hasMore) {
        const response = await fetch(`/api/events/${eventId}/photos?page=${currentPage}&limit=${limit}&lightweight=true`);
        if (response.ok) {
          const data = await response.json();
          if (data.photos && Array.isArray(data.photos)) {
            allPhotos = [...allPhotos, ...data.photos];
            hasMore = data.hasMore || false;
            currentPage++;
          } else {
            // Fallback for old API format
            if (Array.isArray(data)) {
              allPhotos = [...allPhotos, ...data];
            }
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      setPhotos(allPhotos);
      
      // Preload first 10 images for better performance
      const imageUrls = allPhotos.slice(0, 10).map((photo: any) => photo.url);
      if (imageUrls.length > 0) {
        import('@/utils/imagePreloader').then(({ imagePreloader }) => {
          imagePreloader.preloadBatch(imageUrls, 3);
        });
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Removed file upload functionality - only camera selfie mode available

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      setCameraStream(stream);
      setCameraActive(true);
      setUploadedFace(null);
      setCapturedPhoto(null);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check your camera permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = document.getElementById('camera-video') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (video && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(imageData);
      
      // Convert to File for compatibility with existing upload logic
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
          setUploadedFace(file);
        }
      }, 'image/jpeg', 0.8);
      
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setUploadedFace(null);
    startCamera();
  };

  // Clean up camera stream when dialog closes
  useEffect(() => {
    if (!faceScanDialogOpen && cameraStream) {
      stopCamera();
    }
  }, [faceScanDialogOpen]);

  // Gallery scroll behavior - scroll to top when gallery opens
  useEffect(() => {
    if (showInlineGallery) {
      // Scroll to top when gallery view opens
      window.scrollTo(0, 0);
      return () => {
        // Cleanup if needed
      };
    }
  }, [showInlineGallery]);

  // Close download modal when navigating back to events list or switching events
  const [previousEventId, setPreviousEventId] = useState<string | null>(null);
  useEffect(() => {
    // Close modal when navigating back to events list
    if (!showInlineGallery && showDownloadModal) {
      setShowDownloadModal(false);
    }

    // Close modal when switching to a different event (but not on initial load)
    if (selectedEvent?.id && previousEventId && selectedEvent.id !== previousEventId && showDownloadModal) {
      setShowDownloadModal(false);
    }
    
    setPreviousEventId(selectedEvent?.id || null);
  }, [showInlineGallery, selectedEvent?.id, previousEventId, showDownloadModal]);

  // Show inline gallery instead of events list
  if (showInlineGallery && selectedEvent) {

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50">
        <Header />
        
        <main className="pt-16">
          <section className="py-4 md:py-8">
            <div className="container mx-auto px-4">
              {/* Gallery Header with Back Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
                <Button
                  onClick={() => {
                    setShowInlineGallery(false);
                    setSelectedEvent(null);
                    setPhotos([]);
                    // Close download modal if open
                    setShowDownloadModal(false);
                    // Refresh events data when navigating back
                    if (events.length === 0) {
                      fetchEvents(currentPage, debouncedSearchTerm, sortBy, sortOrder);
                    }
                  }}
                  variant="outline"
                  className="flex items-center gap-2 order-1 sm:order-none"
                  size="sm"
                >
                  <Eye className="h-4 w-4" />
                  Back to Events
                </Button>
                
                <div className="text-center flex-1 order-0 sm:order-none w-full sm:w-auto">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800">
                    {selectedEvent.title}
                  </h1>
                  <p className="text-gray-600 mt-1 text-sm md:text-base">
                    {photos.length} photos found
                  </p>
                </div>
                
                <div className="flex flex-col items-end gap-2 order-2 sm:order-none">
                  <Button
                    onClick={downloadAllPhotos}
                    disabled={photos.length === 0 || downloadManager.isActive}
                    variant="outline"
                    className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100 text-sm md:text-base"
                    size="sm"
                  >
                    {downloadManager.isActive ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-2 border-green-600 border-t-transparent"></div>
                        <span className="hidden sm:inline">Downloading...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="hidden sm:inline">Download All ({photos.length})</span>
                        <span className="sm:hidden">All ({photos.length})</span>
                      </>
                    )}
                  </Button>
                  
                  {/* Progress bar for download all */}
                  {downloadManager.isActive && downloadManager.downloads.length > 0 && (
                    <div className="w-full max-w-xs">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Overall Progress</span>
                        <span>
                          {Math.round(
                            downloadManager.downloads.reduce((sum, item) => sum + item.progress, 0) / 
                            downloadManager.downloads.length
                          )}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.round(
                              downloadManager.downloads.reduce((sum, item) => sum + item.progress, 0) / 
                              downloadManager.downloads.length
                            )}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>
                          {downloadManager.downloads.filter(d => d.status === 'completed').length} / {downloadManager.downloads.length} completed
                        </span>
                        <span>
                          {downloadManager.downloads
                            .filter(d => d.status === 'downloading' && d.speed)
                            .reduce((sum, d) => sum + (d.speed || 0), 0) > 0 && (
                            <>
                              {Math.round(
                                downloadManager.downloads
                                  .filter(d => d.status === 'downloading' && d.speed)
                                  .reduce((sum, d) => sum + (d.speed || 0), 0) / 1024 / 1024
                              )} MB/s
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Gallery with Pagination */}
              <PaginatedPhotoGallery
                photos={photos}
                loading={loadingPhotos}
                onPhotoClick={setFullScreenImage}
                className="mt-4"
                showSaveToProfile={true}
                savedPhotoIds={savedPhotoIds}
                onSavePhoto={handleSavePhoto}
                onRemovePhoto={handleRemovePhoto}
                savingPhotoIds={savingPhotoIds}
              />
            </div>
          </section>
        </main>
        
        {/* Simple Full Screen Image Viewer */}
        {fullScreenImage && (
          <SimpleFullscreenViewer
            photo={fullScreenImage}
            photos={photos}
            currentIndex={currentPhotoIndex}
            onClose={() => setFullScreenImage(null)}
            onNext={goToNextPhoto}
            onPrevious={goToPreviousPhoto}
            onIndexChange={(index) => {
              setCurrentPhotoIndex(index);
              setFullScreenImage(photos[index]);
            }}
            savedPhotoIds={savedPhotoIds}
            onSavePhoto={handleSavePhoto}
            onRemovePhoto={handleRemovePhoto}
            savingPhotoIds={savingPhotoIds}
          />
        )}
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="pt-20">
        {/* For direct access (URL/QR), skip the hero section and events grid */}
        {!directEventAccess && (
          <>
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50 py-8 md:py-16">
              <div className="container mx-auto px-4 text-center">
                <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6">
                  <span className="bg-gradient-to-r from-pink-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                    Event Gallery
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-gray-600 mb-6 md:mb-8 max-w-2xl mx-auto px-2">
                  Browse through our captured moments and find your special memories
                </p>
                
                {/* Search Bar */}
                <div className="max-w-md mx-auto relative px-2">
                  <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
                  <Input
                    type="text"
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 md:pl-12 pr-4 py-3 md:py-3 rounded-full border-2 border-pink-200 focus:border-pink-500 text-base"
                  />
                </div>
              </div>
            </section>

            {/* Events Grid */}
            <section className="py-8 md:py-16">
              <div className="container mx-auto px-4">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                    {[...Array(6)].map((_, index) => (
                      <Card key={index} className="overflow-hidden animate-pulse">
                        <div className="w-full h-48 bg-gray-200"></div>
                        <CardHeader>
                          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 mb-4">
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                          </div>
                          <div className="h-10 bg-gray-200 rounded"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                    {events.map((event: Event) => (
                <Card key={event.id} className="group hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
                  <div className="relative overflow-hidden bg-gray-100">
                    <img 
                      src={event.thumbnailUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBpbWFnZSBhdmFpbGFibGU8L3RleHQ+PC9zdmc+'} 
                      alt={event.title}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                    <div className="absolute top-4 right-4">
                      {event.isPrivate ? (
                        <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </div>
                      ) : (
                        <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                          Public
                        </div>
                      )}
                    </div>
                    <div className="absolute top-4 left-4">
                      <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                        {event.category}
                      </div>
                    </div>
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      {event.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span className="text-sm">{new Date(event.eventDate).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="text-sm">{event.location}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Camera className="h-4 w-4 mr-2" />
                        <span className="text-sm">{event.photoCount} photos</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleEventAccess(event)}
                        className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white"
                      >
                        {event.isPrivate ? (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Enter PIN
                          </>
                        ) : (
                          <>
                            <Unlock className="h-4 w-4 mr-2" />
                            View Gallery
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        onClick={() => generateShareUrl(event)}
                        variant="outline"
                        size="sm"
                        disabled={generatingUrl}
                        className="px-3"
                        title="Share Event"
                      >
                        {generatingUrl ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                    ))}
                  </div>
                )}

                {!loading && events.length === 0 && (
                  <div className="text-center py-16">
                    <Camera className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No events found</h3>
                    <p className="text-gray-500">Try adjusting your search terms</p>
                  </div>
                )}

                {/* Pagination */}
                {!loading && pagination && pagination.totalPages > 1 && (
                  <div className="flex flex-col items-center space-y-4 mt-8">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.prevPage || 1)}
                        disabled={!pagination.hasPrevPage}
                        className="flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      {/* Page Numbers */}
                      <div className="flex items-center space-x-1">
                        {/* First page */}
                        {pagination.currentPage > 3 && (
                          <>
                            <Button
                              variant={1 === pagination.currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(1)}
                              className="w-10 h-10"
                            >
                              1
                            </Button>
                            {pagination.currentPage > 4 && <span className="px-1">...</span>}
                          </>
                        )}

                        {/* Current page and surrounding pages */}
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.currentPage - 2 + i;
                          }

                          if (pageNum < 1 || pageNum > pagination.totalPages) return null;

                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === pagination.currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-10 h-10"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}

                        {/* Last page */}
                        {pagination.currentPage < pagination.totalPages - 2 && (
                          <>
                            {pagination.currentPage < pagination.totalPages - 3 && <span className="px-1">...</span>}
                            <Button
                              variant={pagination.totalPages === pagination.currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pagination.totalPages)}
                              className="w-10 h-10"
                            >
                              {pagination.totalPages}
                            </Button>
                          </>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.nextPage || pagination.totalPages)}
                        disabled={!pagination.hasNextPage}
                        className="flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Pagination info */}
                    <div className="text-sm text-gray-600 flex flex-col sm:flex-row items-center gap-2">
                      <span>
                        Page {pagination.currentPage} of {pagination.totalPages}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        {pagination.totalEvents} total events
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        {pagination.limit} per page
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* PIN Entry Dialog for Private Events */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Lock className="h-5 w-5 mr-2 text-red-500" />
              Private Event Access
            </DialogTitle>
            <DialogDescription>
              Enter your PIN to access {selectedEvent?.title} photos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pin">PIN Code</Label>
              <Input
                id="pin"
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className="text-center text-lg tracking-widest"
              />
              {pinError && <p className="text-red-500 text-sm mt-1">{pinError}</p>}
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
              <p className="flex items-center gap-2">
                <span className="font-medium">Public PIN:</span> 
                <span className="text-xs">Face scan required - view your photos only</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Bride-Groom PIN:</span> 
                <span className="text-xs">Full access - view all event photos</span>
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPinDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handlePinSubmit} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                Access Gallery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Face Scan Dialog for Public PIN Access */}
      <Dialog open={faceScanDialogOpen} onOpenChange={setFaceScanDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Scan className="h-5 w-5 mr-2 text-green-500" />
              Face Recognition Required
            </DialogTitle>
            <DialogDescription>
              You've entered the Public PIN. Take a selfie to find your pictures in {selectedEvent?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Only camera mode available - selfie only */}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {/* Show captured photo or uploaded file */}
              {(uploadedFace || capturedPhoto) ? (
                <div className="space-y-2">
                  <img 
                    src={capturedPhoto || URL.createObjectURL(uploadedFace!)} 
                    alt="Face photo" 
                    className="w-20 h-20 rounded-full mx-auto object-cover"
                  />
                  <p className="text-sm text-green-600">
                    {capturedPhoto ? 'Selfie captured' : uploadedFace!.name}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setUploadedFace(null);
                        setCapturedPhoto(null);
                      }}
                    >
                      Remove
                    </Button>
                    {capturedPhoto && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={retakePhoto}
                      >
                        Retake
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {cameraActive ? (
                    <div className="space-y-2">
                      <video
                        id="camera-video"
                        ref={(video) => {
                          if (video && cameraStream) {
                            video.srcObject = cameraStream;
                            video.play();
                          }
                        }}
                        className="w-full max-w-xs mx-auto rounded-lg transform scale-x-[-1]"
                        autoPlay
                        playsInline
                        muted
                      />
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={capturePhoto}
                          className="bg-green-500 hover:bg-green-600 text-white"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Capture Photo
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={stopCamera}
                        >
                          <VideoOff className="h-4 w-4 mr-2" />
                          Stop Camera
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Video className="h-12 w-12 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">Take a clear selfie of your face</p>
                      <Button 
                        variant="outline"
                        onClick={startCamera}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Start Camera
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {scanningFace && (
              <div className="text-center text-sm text-gray-600">
                <p>Please wait a few minutes while we process your face recognition...</p>
                <p className="text-xs mt-1">This may take 2-3 minutes depending on the number of photos</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setFaceScanDialogOpen(false);
                  stopCamera();
                  setCapturedPhoto(null);
                  setUploadedFace(null);
                }} 
                className="flex-1 hover:bg-red-600 hover:text-white bg-[#ffffff] text-[#ff0000] border border-red-300 shadow-md"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleFaceScan}
                disabled={!uploadedFace || scanningFace}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                {scanningFace ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Find My Photos'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Simple Full Screen Image Viewer */}
      {fullScreenImage && (
        <SimpleFullscreenViewer
          photo={fullScreenImage}
          photos={photos}
          currentIndex={currentPhotoIndex}
          onClose={() => setFullScreenImage(null)}
          onNext={goToNextPhoto}
          onPrevious={goToPreviousPhoto}
          onIndexChange={(index) => {
            setCurrentPhotoIndex(index);
            setFullScreenImage(photos[index]);
          }}
          savedPhotoIds={savedPhotoIds}
          onSavePhoto={handleSavePhoto}
          onRemovePhoto={handleRemovePhoto}
          savingPhotoIds={savingPhotoIds}
        />
      )}

      {/* Share Event Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Event: {shareEvent?.title}
            </DialogTitle>
            <DialogDescription>
              Share this event with others using the URL below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {shareUrl && (
              <div className="space-y-3">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="flex-1"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyShareUrl}
                      className="shrink-0"
                      title="Copy URL"
                    >
                      {copiedUrl ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={openShareUrl}
                      className="shrink-0"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Progress Modal */}
      <DownloadProgressModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        downloads={downloadManager.downloads}
        onCancel={downloadManager.cancelDownloads}
        onPause={downloadManager.pauseDownloads}
        onResume={downloadManager.resumeDownloads}
        isPaused={downloadManager.isPaused}
        title={`Downloading ${selectedEvent?.title || 'Event'} Photos`}
      />

      <Footer />
    </div>
  );
};

export default Events;
