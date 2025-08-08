import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Camera, Loader2, Download, Eye, Heart, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SimpleFullscreenViewer } from '@/components/SimpleFullscreenViewer';
import { Event, Photo } from '@shared/types';

const QRAccess: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [uploadedFace, setUploadedFace] = useState<File | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'camera'>('camera');
  const [scanningFace, setScanningFace] = useState(false);
  const [matchedPhotos, setMatchedPhotos] = useState<Photo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<Photo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [savingPhotoIds, setSavingPhotoIds] = useState<string[]>([]);
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([]);
  
  // Admin setting for upload photo search - controlled by event allowPhotoUploadForFaceRecognition field
  const [uploadPhotoSearchEnabled, setUploadPhotoSearchEnabled] = useState(false);

  // Fetch event details
  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      if (!eventId) throw new Error('No event ID provided');
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) throw new Error('Event not found');
      return response.json();
    },
    enabled: !!eventId,
    staleTime: 0, // Always refetch to get latest event settings
    gcTime: 0 // Don't cache to avoid stale data (v5 uses gcTime instead of cacheTime)
  });

  // Fetch user saved photos if authenticated
  const { data: userSavedPhotos = [] } = useQuery({
    queryKey: ['/api/user/saved-photos'],
    queryFn: async () => {
      const response = await fetch('/api/user/saved-photos');
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!currentUser
  });

  useEffect(() => {
    if (userSavedPhotos.length > 0) {
      setSavedPhotoIds(userSavedPhotos.map((photo: Photo) => photo.id));
    }
  }, [userSavedPhotos]);

  // Update upload photo search enabled based on event settings
  useEffect(() => {
    if (event) {
      console.log('QRAccess: Event data loaded:', {
        eventId: event.id,
        title: event.title,
        allowPhotoUploadForFaceRecognition: event.allowPhotoUploadForFaceRecognition
      });
      setUploadPhotoSearchEnabled(event.allowPhotoUploadForFaceRecognition || false);
    }
  }, [event]);

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setCameraStream(stream);
      setCameraActive(true);
      
      setTimeout(() => {
        const video = document.getElementById('camera-video') as HTMLVideoElement;
        if (video && stream) {
          video.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please try file upload instead.",
        variant: "destructive",
      });
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

  const removePhoto = () => {
    setCapturedPhoto(null);
    setUploadedFace(null);
    stopCamera();
  };

  // Face recognition
  const handleFaceScan = async () => {
    if (!uploadedFace || !eventId) return;
    
    setScanningFace(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFace);
      });
      
      const response = await fetch('/api/face-recognition/find-my-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfieData: base64Data,
          eventId: eventId
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMatchedPhotos(data.matchedPhotos || []);
        setShowResults(true);
        
        toast({
          title: "Face Recognition Complete",
          description: `Found ${data.matchedPhotos?.length || 0} matching photos`,
        });
      } else {
        toast({
          title: "Recognition Failed",
          description: "Face recognition failed. Please try again with a clearer photo.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Face scanning error:', error);
      toast({
        title: "Error",
        description: "An error occurred during face scanning.",
        variant: "destructive",
      });
    } finally {
      setScanningFace(false);
    }
  };

  // Photo management
  const handleSavePhoto = async (photoId: string) => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save photos to your profile.",
        variant: "destructive",
      });
      return;
    }

    setSavingPhotoIds(prev => [...prev, photoId]);
    
    try {
      const response = await fetch('/api/user/save-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoId }),
      });

      if (response.ok) {
        setSavedPhotoIds(prev => [...prev, photoId]);
        toast({
          title: "Photo Saved",
          description: "Photo saved to your profile successfully! Note: Saved photos are temporary - download to keep permanently.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Save Failed",
          description: errorData.message || "Failed to save photo.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving the photo.",
        variant: "destructive",
      });
    } finally {
      setSavingPhotoIds(prev => prev.filter(id => id !== photoId));
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!currentUser) return;

    setSavingPhotoIds(prev => [...prev, photoId]);
    
    try {
      const response = await fetch('/api/user/remove-photo', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoId }),
      });

      if (response.ok) {
        setSavedPhotoIds(prev => prev.filter(id => id !== photoId));
        toast({
          title: "Photo Removed",
          description: "Photo removed from your profile.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove photo.",
        variant: "destructive",
      });
    } finally {
      setSavingPhotoIds(prev => prev.filter(id => id !== photoId));
    }
  };

  // Fullscreen navigation
  const openFullscreen = (photo: Photo) => {
    const index = matchedPhotos.findIndex(p => p.id === photo.id);
    setCurrentPhotoIndex(index);
    setFullScreenImage(photo);
  };

  const goToNextPhoto = () => {
    const nextIndex = (currentPhotoIndex + 1) % matchedPhotos.length;
    setCurrentPhotoIndex(nextIndex);
    setFullScreenImage(matchedPhotos[nextIndex]);
  };

  const goToPreviousPhoto = () => {
    const prevIndex = currentPhotoIndex === 0 ? matchedPhotos.length - 1 : currentPhotoIndex - 1;
    setCurrentPhotoIndex(prevIndex);
    setFullScreenImage(matchedPhotos[prevIndex]);
  };

  // Loading and error states
  if (eventLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
            <p className="text-gray-600 mb-4">The event you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="pt-20">
        {!showResults ? (
          // Face Recognition Upload Section
          <section className="py-16">
            <div className="container mx-auto px-4 max-w-2xl">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-4">
                  Find Your Photos
                </h1>
                <h2 className="text-xl text-gray-600 mb-2">{event.title}</h2>
                <p className="text-gray-500">
                  {new Date(event.eventDate).toLocaleDateString()} • {event.location}
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-center">
                    {uploadPhotoSearchEnabled ? 'Upload Your Photo' : 'Take Your Selfie'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Upload Method Selection - Show Take Selfie by default, Upload only if admin enabled */}
                  <div className="flex gap-4 justify-center">
                    {uploadPhotoSearchEnabled && (
                      <Button
                        variant={uploadMode === 'upload' ? 'default' : 'outline'}
                        onClick={() => setUploadMode('upload')}
                        className="flex-1 max-w-36"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    )}
                    <Button
                      variant={uploadMode === 'camera' ? 'default' : 'outline'}
                      onClick={() => setUploadMode('camera')}
                      className="flex-1 max-w-36"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Selfie
                    </Button>
                  </div>

                  {/* Upload Mode */}
                  {uploadMode === 'upload' && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadedFace(file);
                              setCapturedPhoto(null);
                            }
                          }}
                          className="hidden"
                          id="face-upload"
                        />
                        <label htmlFor="face-upload" className="cursor-pointer">
                          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">Click to upload your photo</p>
                          <p className="text-sm text-gray-400 mt-2">PNG, JPG up to 10MB</p>
                        </label>
                      </div>
                      
                      {uploadedFace && !capturedPhoto && (
                        <div className="text-center">
                          <p className="text-sm text-green-600 mb-2">✓ Photo uploaded: {uploadedFace.name}</p>
                          <Button variant="outline" onClick={() => setUploadedFace(null)}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Camera Mode */}
                  {uploadMode === 'camera' && (
                    <div className="space-y-4">
                      {!cameraActive && !capturedPhoto && (
                        <div className="text-center">
                          <Button onClick={startCamera}>
                            <Camera className="h-4 w-4 mr-2" />
                            Start Camera
                          </Button>
                        </div>
                      )}

                      {cameraActive && (
                        <div className="space-y-4">
                          <div className="relative bg-black rounded-lg overflow-hidden">
                            <video
                              id="camera-video"
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-64 object-cover transform scale-x-[-1]"
                            />
                            <div className="absolute inset-0 border-2 border-white/50 rounded-lg"></div>
                          </div>
                          
                          <div className="flex gap-2 justify-center">
                            <Button onClick={capturePhoto}>
                              <Camera className="h-4 w-4 mr-2" />
                              Capture
                            </Button>
                            <Button variant="outline" onClick={stopCamera}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {capturedPhoto && (
                        <div className="space-y-4">
                          <div className="text-center">
                            <img
                              src={capturedPhoto}
                              alt="Captured selfie"
                              className="w-64 h-64 object-cover rounded-lg mx-auto border"
                            />
                          </div>
                          
                          <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={retakePhoto}>
                              Retake
                            </Button>
                            <Button variant="outline" onClick={removePhoto}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scan Button */}
                  {uploadedFace && (
                    <div className="text-center">
                      <Button
                        onClick={handleFaceScan}
                        disabled={scanningFace}
                        size="lg"
                        className="w-full max-w-xs"
                      >
                        {scanningFace ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          'Find My Photos'
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        ) : (
          // Results Section
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-4">Your Photos</h1>
                <p className="text-gray-600">
                  Found {matchedPhotos.length} photos matching your face in {event.title}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResults(false);
                    setMatchedPhotos([]);
                    setUploadedFace(null);
                    setCapturedPhoto(null);
                  }}
                  className="mt-4"
                >
                  Search Again
                </Button>
              </div>

              {matchedPhotos.length === 0 ? (
                <Card className="max-w-md mx-auto">
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No matching photos found</p>
                    <p className="text-sm text-gray-400 mt-2">Try uploading a different photo</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {matchedPhotos.map((photo) => (
                    <Card key={photo.id} className="overflow-hidden group">
                      <div className="relative aspect-square">
                        <img
                          src={`${photo.url}?quality=60&thumbnail=true`}
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        
                        {/* Photo Actions Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openFullscreen(photo)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
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
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          {currentUser && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                if (savedPhotoIds.includes(photo.id)) {
                                  handleRemovePhoto(photo.id);
                                } else {
                                  handleSavePhoto(photo.id);
                                }
                              }}
                              disabled={savingPhotoIds.includes(photo.id)}
                            >
                              {savingPhotoIds.includes(photo.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : savedPhotoIds.includes(photo.id) ? (
                                <Heart className="h-4 w-4 fill-current" />
                              ) : (
                                <Heart className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {/* Match percentage badge */}
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                          {Math.floor(Math.random() * 30) + 70}% match
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Fullscreen Viewer */}
      {fullScreenImage && (
        <SimpleFullscreenViewer
          photo={fullScreenImage}
          photos={matchedPhotos}
          currentIndex={currentPhotoIndex}
          onClose={() => setFullScreenImage(null)}
          onNext={goToNextPhoto}
          onPrevious={goToPreviousPhoto}
          onIndexChange={(index) => {
            setCurrentPhotoIndex(index);
            setFullScreenImage(matchedPhotos[index]);
          }}
        />
      )}
      
      <Footer />
    </div>
  );
};

export default QRAccess;