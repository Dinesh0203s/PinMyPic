import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getHDThumbnailUrl, getOriginalSizeThumbnailUrl, getEventCardThumbnailUrl, getPremiumEventCardThumbnailUrl } from '@/utils/imagePreloader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Save, 
  Edit, 
  Calendar, 
  MapPin, 
  Camera, 
  Lock, 
  Unlock,
  Eye,
  X,
  Grid,
  Download,
  Trash2,
  Upload,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Share2,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Event, Photo } from '@shared/types';
import { PhotoUploadDialog } from './PhotoUploadDialog';
import AdminPhotoGallery from './AdminPhotoGallery';
import { DeleteConfirmation } from '@/components/ui/confirmation-alert';
import { EventShareDialog } from './EventShareDialog';
import { PremiumThumbnailEditor } from './PremiumThumbnailEditor';

interface EventDetailsDialogProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdated: () => void;
  initialEditMode?: boolean;
}

export function EventDetailsDialog({ event, open, onOpenChange, onEventUpdated, initialEditMode = false }: EventDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [showThumbnailEditor, setShowThumbnailEditor] = useState(false);
  const [thumbnailEditImage, setThumbnailEditImage] = useState<string>('');
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<Photo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
          event.stopPropagation(); // Prevent dialog from closing
          setFullScreenImage(null);
          setActiveTab('gallery'); // Ensure we're on the gallery tab
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

  const [editData, setEditData] = useState({
    title: '',
    description: '',
    eventDate: '',
    location: '',
    category: '',
    isPrivate: false,
    publicPin: '',
    brideGroomPin: '',
    passcode: '',
    enableImageCompression: false
  });

  const categories = [
    'Wedding',
    'Corporate',
    'Birthday',
    'Family',
    'Graduation',
    'Concert',
    'Other'
  ];

  useEffect(() => {
    if (event) {
      setEditData({
        title: event.title,
        description: event.description || '',
        eventDate: event.eventDate.split('T')[0],
        location: event.location,
        category: event.category,
        isPrivate: event.isPrivate,
        publicPin: event.publicPin || '',
        brideGroomPin: event.brideGroomPin || '',
        passcode: event.passcode || '',
        enableImageCompression: event.enableImageCompression || false
      });
      
      if (activeTab === 'gallery') {
        loadPhotos();
      }
    }
  }, [event, activeTab]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && event) {
      setActiveTab('details');
      setPhotos([]);
      setIsEditing(initialEditMode);
    }
  }, [open, event, initialEditMode]);

  const loadPhotos = async () => {
    if (!event) return;
    
    setLoadingPhotos(true);
    try {
      let allPhotos: Photo[] = [];
      let currentPage = 1;
      let hasMore = true;
      const limit = 500; // Fetch 500 photos per request
      
      // Fetch all photos by making multiple paginated requests
      while (hasMore) {
        const response = await fetch(`/api/events/${event.id}/photos?page=${currentPage}&limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          // Handle both new paginated format and old direct array format
          if (data.photos && Array.isArray(data.photos)) {
            allPhotos = [...allPhotos, ...data.photos];
            hasMore = data.hasMore || false;
            currentPage++;
          } else if (Array.isArray(data)) {
            // Fallback for old API format
            allPhotos = [...allPhotos, ...data];
            hasMore = false;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      setPhotos(allPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      toast({
        title: "Error",
        description: "Failed to load photos",
        variant: "destructive"
      });
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setDeletingPhotoId(photoId);
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Photo deleted successfully"
        });
        // Remove photo from local state
        setPhotos(photos.filter(p => p.id !== photoId));
        // Refresh event data to update photo count
        onEventUpdated();
      } else {
        throw new Error('Failed to delete photo');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: "Error",
        description: "Failed to delete photo",
        variant: "destructive"
      });
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleBulkDeletePhotos = async (photoIds: string[]) => {
    console.log('Starting bulk delete for photo IDs:', photoIds);
    
    try {
      // Validate photo IDs before sending
      if (!photoIds || photoIds.length === 0) {
        throw new Error('No photos selected for deletion');
      }
      
      const invalidIds = photoIds.filter(id => !id || typeof id !== 'string' || id.trim() === '');
      if (invalidIds.length > 0) {
        console.error('Invalid photo IDs found:', invalidIds);
        throw new Error(`Invalid photo IDs: ${invalidIds.join(', ')}`);
      }
      
      console.log('Sending bulk delete request with', photoIds.length, 'photo IDs');
      
      const response = await fetch('/api/photos/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          photoIds,
          captchaResponse: 'DELETE_ALL_PHOTOS_CONFIRMED'
        })
      });

      console.log('Bulk delete response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Bulk delete successful:', result);
        
        toast({
          title: "Success",
          description: result.message || `${photoIds.length} photos deleted successfully`
        });
        
        // Clear any selected photos in the gallery first
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('clearPhotoSelection'));
        }
        
        // Remove deleted photos from local state using functional update
        setPhotos(prevPhotos => {
          const filtered = prevPhotos.filter(p => !photoIds.includes(p.id));
          console.log(`Removed ${photoIds.length} photos, ${filtered.length} remaining`);
          return filtered;
        });
        
        // Refresh event data to update photo count
        onEventUpdated();
        
        // Force reload photos to ensure UI is completely in sync
        setTimeout(() => {
          console.log('Reloading photos after bulk delete...');
          loadPhotos();
        }, 200);
      } else {
        const errorData = await response.json();
        console.error('Bulk delete failed:', errorData);
        throw new Error(errorData.error || `Failed to delete photos (${response.status})`);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete photos",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleSetAsThumbnail = async (photoUrl: string) => {
    if (!event) return;
    
    setUploadingThumbnail(true);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ thumbnailUrl: photoUrl })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Event thumbnail updated successfully"
        });
        onEventUpdated();
      } else {
        throw new Error('Failed to update thumbnail');
      }
    } catch (error) {
      console.error('Error updating thumbnail:', error);
      toast({
        title: "Error",
        description: "Failed to update thumbnail",
        variant: "destructive"
      });
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleSave = async () => {
    if (!event) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Event updated successfully"
        });
        setIsEditing(false);
        onEventUpdated();
        // Update the dialog with new data
        const updatedEvent = await response.json();
        if (updatedEvent) {
          setEditData({
            title: updatedEvent.title,
            description: updatedEvent.description || '',
            eventDate: updatedEvent.eventDate.split('T')[0],
            location: updatedEvent.location,
            category: updatedEvent.category,
            isPrivate: updatedEvent.isPrivate,
            publicPin: updatedEvent.publicPin || '',
            brideGroomPin: updatedEvent.brideGroomPin || '',
            passcode: updatedEvent.passcode || '',
            enableImageCompression: updatedEvent.enableImageCompression || false
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update event",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;

    // Only accept JPEG/JPG files
    if (!file.type.match(/^image\/jpe?g$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPEG image file",
        variant: "destructive"
      });
      return;
    }

    setUploadingThumbnail(true);
    const formData = new FormData();
    formData.append('photos', file); // Changed from 'file' to 'photos' to match multer config
    formData.append('eventId', event.id);
    formData.append('filename', file.name);

    try {
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // Set the uploaded photo as thumbnail
        await handleSetAsThumbnail(data.photo.url);
        // Load photos to show the new upload
        loadPhotos();
      } else {
        throw new Error('Failed to upload thumbnail');
      }
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      toast({
        title: "Error",
        description: "Failed to upload thumbnail",
        variant: "destructive"
      });
    } finally {
      setUploadingThumbnail(false);
      // Reset input
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = '';
      }
    }
  };

  const handleEditThumbnail = (photoUrl: string) => {
    if (!photoUrl) {
      toast({
        title: "Error",
        description: "No image URL provided",
        variant: "destructive"
      });
      return;
    }
    setThumbnailEditImage(photoUrl);
    setShowThumbnailEditor(true);
  };

  const handleSaveEditedThumbnail = async (editedImageDataUrl: string) => {
    if (!event) return;
    
    setUploadingThumbnail(true);
    try {
      // Convert data URL to blob
      const response = await fetch(editedImageDataUrl);
      const blob = await response.blob();
      
      // Create FormData for upload
      const formData = new FormData();
      formData.append('photos', blob, 'edited-thumbnail.jpg');
      formData.append('eventId', event.id);
      
      // Upload the edited thumbnail
      const uploadResponse = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        
        // Get authentication token
        const token = await currentUser?.getIdToken();
        
        // Update event with new thumbnail
        const updateResponse = await fetch(`/api/events/${event.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            thumbnailUrl: result.photo.url
          }),
        });
        
        if (updateResponse.ok) {
          toast({
            title: "Success",
            description: "Thumbnail updated successfully",
          });
          onEventUpdated();
          setShowThumbnailEditor(false);
        } else {
          throw new Error('Failed to update event thumbnail');
        }
      } else {
        throw new Error('Failed to upload edited thumbnail');
      }
    } catch (error) {
      console.error('Error saving edited thumbnail:', error);
      toast({
        title: "Error",
        description: "Failed to save edited thumbnail",
        variant: "destructive"
      });
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleCancel = () => {
    if (event) {
      setEditData({
        title: event.title,
        description: event.description || '',
        eventDate: event.eventDate.split('T')[0],
        location: event.location,
        category: event.category,
        isPrivate: event.isPrivate,
        publicPin: event.publicPin || '',
        brideGroomPin: event.brideGroomPin || '',
        passcode: event.passcode || '',
        enableImageCompression: event.enableImageCompression || false
      });
    }
    setIsEditing(false);
  };

  if (!event) return null;

  return (
    <Dialog 
      open={open} 
      onOpenChange={fullScreenImage ? undefined : onOpenChange} // Prevent closing when in slideshow
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onOpenChange(false)}
              className="p-1 h-auto flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">{event.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and manage event details including photos, thumbnail, and event information
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="details" className="flex items-center gap-1 text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
              <Edit className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Event Details</span>
              <span className="sm:hidden">Details</span>
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center gap-1 text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
              <Camera className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Photo Gallery ({event.photoCount})</span>
              <span className="sm:hidden">Gallery ({event.photoCount})</span>
            </TabsTrigger>
            <TabsTrigger value="thumbnail" className="flex items-center gap-1 text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
              <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Edit Thumbnail</span>
              <span className="sm:hidden">Thumbnail</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Mobile Layout */}
            <div className="md:hidden space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Event Information</h3>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSave} disabled={loading} size="sm">
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleCancel} variant="outline" size="sm">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => setShareDialogOpen(true)} 
                variant="outline" 
                size="sm"
                className="w-full flex items-center justify-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share Event URL
              </Button>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center justify-between">
              <Button 
                onClick={() => setShareDialogOpen(true)} 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share Event URL
              </Button>
              <h3 className="text-lg font-semibold">Event Information</h3>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={loading} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)} size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Event
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Event Title</Label>
                    {isEditing ? (
                      <Input
                        id="title"
                        value={editData.title}
                        onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter event title"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">{event.title}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    {isEditing ? (
                      <Textarea
                        id="description"
                        value={editData.description}
                        onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter event description"
                        rows={3}
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">{event.description || 'No description provided'}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="eventDate">Event Date</Label>
                    {isEditing ? (
                      <Input
                        id="eventDate"
                        type="date"
                        value={editData.eventDate}
                        onChange={(e) => setEditData(prev => ({ ...prev, eventDate: e.target.value }))}
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(event.eventDate).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    {isEditing ? (
                      <Input
                        id="location"
                        value={editData.location}
                        onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Enter event location"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600 flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        {event.location}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    {isEditing ? (
                      <Select 
                        value={editData.category} 
                        onValueChange={(value) => setEditData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="mt-1">
                        {event.category}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Privacy & Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Event Type</Label>
                    {isEditing ? (
                      <Select 
                        value={editData.isPrivate.toString()} 
                        onValueChange={(value) => setEditData(prev => ({ ...prev, isPrivate: value === 'true' }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Public Event</SelectItem>
                          <SelectItem value="true">Private Event</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge variant={event.isPrivate ? "destructive" : "secondary"} className="flex items-center w-fit">
                          {event.isPrivate ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                          {event.isPrivate ? 'Private' : 'Public'}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="publicPin">Public PIN</Label>
                    {isEditing ? (
                      <Input
                        id="publicPin"
                        value={editData.publicPin}
                        onChange={(e) => setEditData(prev => ({ ...prev, publicPin: e.target.value }))}
                        placeholder="Enter public PIN"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600 font-mono">
                        {event.publicPin || 'Not set'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="brideGroomPin">Bride & Groom PIN</Label>
                    {isEditing ? (
                      <Input
                        id="brideGroomPin"
                        value={editData.brideGroomPin}
                        onChange={(e) => setEditData(prev => ({ ...prev, brideGroomPin: e.target.value }))}
                        placeholder="Enter bride & groom PIN"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600 font-mono">
                        {event.brideGroomPin || 'Not set'}
                      </p>
                    )}
                  </div>

                  {/* Image Compression Toggle */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="enableImageCompression"
                            checked={editData.enableImageCompression}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, enableImageCompression: checked }))}
                            disabled={!isEditing}
                          />
                          <Label htmlFor="enableImageCompression" className="text-sm font-medium text-blue-800">
                            Enable Image Compression
                          </Label>
                        </div>
                      </div>
                      <div className="text-xs text-blue-600 sm:text-right">
                        {editData.enableImageCompression 
                          ? "Images will be compressed and uploaded automatically (faster upload, smaller files)" 
                          : "Original images will be uploaded manually (slower upload, larger files)"
                        }
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Photo Count:</span>
                      <span className="font-medium flex items-center">
                        <Camera className="h-4 w-4 mr-1" />
                        {event.photoCount} photos
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-500">Created:</span>
                      <span className="text-gray-600">{new Date(event.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500">Updated:</span>
                      <span className="text-gray-600">{new Date(event.updatedAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Event Thumbnail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {event.thumbnailUrl ? (
                    <div className="space-y-4">
                      <img 
                        src={event.thumbnailUrl ? getPremiumEventCardThumbnailUrl(event.thumbnailUrl) : ''} 
                        alt="Event thumbnail" 
                        className="w-full max-w-md h-[400px] object-cover rounded-lg border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/400x300?text=No+Thumbnail';
                        }}
                      />
                      <p className="text-xs text-gray-500">Current thumbnail image</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full max-w-md h-[400px] bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No thumbnail set</p>
                        <p className="text-xs text-gray-400 mt-1">Select a photo from the gallery to set as thumbnail</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                        id="thumbnail-upload"
                      />
                      <label
                        htmlFor="thumbnail-upload"
                        className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all ${uploadingThumbnail ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploadingThumbnail ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            Upload JPEG Thumbnail
                          </>
                        )}
                      </label>
                      <span className="text-xs text-gray-500">JPEG files only</span>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <p className="mb-2">Or set from gallery:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to the Photo Gallery tab</li>
                        <li>Hover over any photo</li>
                        <li>Click the camera icon to set it as thumbnail</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Grid className="h-5 w-5" />
                Photo Gallery
              </h3>
              <div className="flex gap-2">
                <PhotoUploadDialog 
                  eventId={event.id} 
                  eventTitle={event.title}
                  onPhotosUploaded={() => {
                    loadPhotos();
                    onEventUpdated();
                  }}
                />
                <Button onClick={loadPhotos} variant="outline" size="sm">
                  <Camera className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <AdminPhotoGallery
              key={`gallery-${photos.length}-${event?.id}`}
              photos={photos}
              loading={loadingPhotos}
              onPhotoClick={setFullScreenImage}
              onDeletePhoto={handleDeletePhoto}
              onBulkDeletePhotos={handleBulkDeletePhotos}
              onSetAsThumbnail={handleSetAsThumbnail}
              onEditThumbnail={handleEditThumbnail}
              currentThumbnailUrl={event?.thumbnailUrl}
              deletingPhotoId={deletingPhotoId}
              uploadingThumbnail={uploadingThumbnail}
            />
          </TabsContent>

          <TabsContent value="thumbnail" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Edit Thumbnail
              </h3>
            </div>
            
            <div className="space-y-4">
              {/* Current Thumbnail Display */}
              {event.thumbnailUrl ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
                      <img
                        src={event.thumbnailUrl ? getPremiumEventCardThumbnailUrl(event.thumbnailUrl) : ''}
                        alt="Current thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">Current Thumbnail</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        This is the current thumbnail for this event. Click "Edit Thumbnail" to modify it.
                      </p>
                      <Button
                        onClick={() => handleEditThumbnail(event.thumbnailUrl!)}
                        className="flex items-center gap-2"
                        disabled={uploadingThumbnail}
                      >
                        <Edit className="h-4 w-4" />
                        Edit Thumbnail
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">No Thumbnail Set</p>
                  <p className="text-sm mb-4">
                    This event doesn't have a thumbnail yet. Upload photos and set one as thumbnail, or upload a thumbnail directly.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => setActiveTab('gallery')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Go to Gallery
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Full Screen Image Viewer with Slideshow */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black"
          onClick={(e) => {
            // Only close if clicking on the background (not on buttons or image)
            if (e.target === e.currentTarget) {
              setFullScreenImage(null);
              setActiveTab('gallery');
            }
          }}
        >
          {/* Header with back button and download */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
            <div className="flex items-center justify-between text-white">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Back button clicked');
                  setFullScreenImage(null);
                  setActiveTab('gallery');
                }}
                className="text-white hover:bg-white/20 pointer-events-auto cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Event Gallery
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-75">
                  {currentPhotoIndex + 1} of {photos.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Download button clicked');
                    const link = document.createElement('a');
                    link.href = fullScreenImage.url;
                    link.download = fullScreenImage.filename;
                    link.click();
                  }}
                  className="text-white hover:bg-white/20 pointer-events-auto cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Close button clicked');
                    setFullScreenImage(null);
                    setActiveTab('gallery');
                  }}
                  className="text-white hover:bg-white/20 pointer-events-auto cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              {/* Previous Button */}
              <Button
                variant="ghost"
                size="lg"
                onClick={goToPreviousPhoto}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 text-white hover:bg-white/20 h-16 w-16 rounded-full pointer-events-auto"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>

              {/* Next Button */}
              <Button
                variant="ghost"
                size="lg"
                onClick={goToNextPhoto}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 text-white hover:bg-white/20 h-16 w-16 rounded-full pointer-events-auto"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Image container */}
          <div className="flex items-center justify-center h-full p-4 pt-20 pb-20">
            <img
              src={fullScreenImage.url}
              alt={fullScreenImage.filename}
              className="max-w-full max-h-full object-contain transition-opacity duration-300"
              style={{ maxHeight: 'calc(100vh - 160px)' }}
            />
          </div>

          {/* Footer with action buttons and navigation dots */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="text-center text-white">
              {/* Action buttons below the image */}
              <div className="flex items-center justify-center gap-4 mb-4">
                {/* Download Button */}
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = fullScreenImage.url;
                    link.download = fullScreenImage.filename;
                    link.click();
                  }}
                  className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 text-white"
                >
                  <Download className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Navigation dots for smaller photo sets */}
              {photos.length > 1 && photos.length <= 10 && (
                <div className="flex justify-center gap-2">
                  {photos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentPhotoIndex(index);
                        setFullScreenImage(photos[index]);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentPhotoIndex 
                          ? 'bg-white scale-125' 
                          : 'bg-white/50 hover:bg-white/75'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Share Dialog */}
      <EventShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        event={event}
      />

      {/* Thumbnail Editor */}
      <PremiumThumbnailEditor
        imageUrl={thumbnailEditImage}
        open={showThumbnailEditor}
        onOpenChange={setShowThumbnailEditor}
        onSave={handleSaveEditedThumbnail}
      />
    </Dialog>
  );
}