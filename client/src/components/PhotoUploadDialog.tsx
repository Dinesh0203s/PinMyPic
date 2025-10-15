import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Upload, Camera, X, FileImage, AlertCircle, CheckCircle, Smartphone, Shield, Settings, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadOptimizer, MemoryMonitor } from '@/utils/uploadOptimizer';
import { uploadQueueManager, DynamicUploadStats } from '@/utils/dynamicUploadProcessor';
import { imageCompressor } from '@/utils/imageCompression';
import { CompressionUploadQueue, type CompressionQueueItem, type CompressionQueueStats } from '@/utils/compressionUploadQueue';

interface PhotoUploadDialogProps {
  eventId: string;
  eventTitle: string;
  onPhotosUploaded: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  eventCompressionSetting?: boolean;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
  jobId?: string; // For async uploads
}

export function PhotoUploadDialog({ 
  eventId, 
  eventTitle, 
  onPhotosUploaded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  eventCompressionSetting = false
}: PhotoUploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [hasWakeLockSupport, setHasWakeLockSupport] = useState(false);
  const [dynamicStats, setDynamicStats] = useState<DynamicUploadStats | null>(null);
  const [compressionQuality, setCompressionQuality] = useState<number>(1.0);
  const [showCompressionSettings, setShowCompressionSettings] = useState(false);
  
  // Compression queue state
  const [compressionQueue, setCompressionQueue] = useState<CompressionUploadQueue | null>(null);
  const [queueItems, setQueueItems] = useState<CompressionQueueItem[]>([]);
  const [queueStats, setQueueStats] = useState<CompressionQueueStats | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  // Use controlled props if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  // Storage key for persisting upload state
  const STORAGE_KEY = `upload_state_${eventId}`;

  // Check for wake lock support on mount
  useEffect(() => {
    setHasWakeLockSupport('wakeLock' in navigator);
  }, []);

  // Clear persisted upload state on page refresh to prevent errors
  useEffect(() => {
    const clearStateOnRefresh = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          // Check if page was refreshed by looking for navigation type
          const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const isPageRefresh = navigationEntry?.type === 'reload';
          
          if (isPageRefresh) {
            // Automatically clear localStorage on page refresh to prevent errors
            clearPersistedState();
            return;
          }

          // Only attempt to load persisted state if not a page refresh
          const { files, uploading } = JSON.parse(saved);
          if (files && files.length > 0 && Array.isArray(files)) {
            // Validate that files have the required structure
            const validStatuses = ['pending', 'uploading', 'completed', 'error'] as const;
            const validFiles = files.filter((f: any) => 
              f && f.file && f.id && validStatuses.includes(f.status) && typeof f.progress === 'number'
            ) as UploadFile[];
            
            if (validFiles.length > 0) {
              setUploadFiles(validFiles);
              if (uploading) {
                toast({
                  title: "Upload resumed",
                  description: `Found ${validFiles.length} photos from previous session. Continue uploading or clear them?`,
                  action: (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          // Reset pending files and restart upload
                          const pendingFiles = validFiles.map((f: UploadFile) => 
                            f.status === 'uploading' ? { ...f, status: 'pending' as const } : f
                          );
                          setUploadFiles(pendingFiles);
                          handleUploadAll();
                        }}
                      >
                        Resume
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          clearPersistedState();
                          setUploadFiles([]);
                          toast({
                            title: "Cleared",
                            description: "Previous upload session cleared."
                          });
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )
                });
              }
            } else {
              // Invalid data, clear it
              clearPersistedState();
            }
          }
        }
      } catch (error) {
        console.error('Failed to handle persisted upload state:', error);
        // Clear corrupted data
        clearPersistedState();
        toast({
          title: "Upload state cleared",
          description: "Previous upload session data was corrupted and has been cleared.",
          variant: "default"
        });
      }
    };

    if (eventId && isOpen) {
      clearStateOnRefresh();
    }
  }, [eventId, isOpen]);

  // Save upload state to localStorage
  const saveUploadState = useCallback((files: UploadFile[], uploading: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        files: files.map(f => ({
          ...f,
          file: null // Don't persist the actual file object
        })),
        uploading,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }, [STORAGE_KEY]);

  // Clear persisted state
  const clearPersistedState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear persisted state:', error);
    }
  }, [STORAGE_KEY]);

  // Request wake lock to prevent screen from turning off during upload
  const requestWakeLock = async () => {
    if (!hasWakeLockSupport) return;
    
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      setWakeLock(wakeLock);
      
      wakeLock.addEventListener('release', () => {
      });
      
      toast({
        title: "Screen lock prevented",
        description: "Your screen will stay on during upload to prevent interruptions."
      });
    } catch (error) {
      console.error('Wake lock request failed:', error);
    }
  };

  // Release wake lock
  const releaseWakeLock = async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
      } catch (error) {
        console.error('Wake lock release failed:', error);
      }
    }
  };

  // Handle page visibility changes (when user switches tabs or minimizes browser)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isUploading) {
        saveUploadState(uploadFiles, isUploading);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        saveUploadState(uploadFiles, isUploading);
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isUploading, uploadFiles, saveUploadState]);

  // Update uploadFiles state and persist
  const updateUploadFiles = useCallback((updater: (prev: UploadFile[]) => UploadFile[]) => {
    setUploadFiles(prev => {
      const newFiles = updater(prev);
      saveUploadState(newFiles, isUploading);
      return newFiles;
    });
  }, [isUploading, saveUploadState]);



  const processFiles = async (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "Invalid files detected",
        description: "Only image files are allowed.",
        variant: "destructive"
      });
    }

    if (imageFiles.length === 0) {
      toast({
        title: "No valid images",
        description: "Please select image files (JPG, PNG, WebP).",
        variant: "destructive"
      });
      return;
    }

    // Use upload optimizer to check if browser can handle the upload
    const optimizer = UploadOptimizer.getInstance();
    const canHandle = optimizer.canHandleUpload(imageFiles);
    
    if (!canHandle.canHandle) {
      toast({
        title: "Upload too large",
        description: canHandle.reason,
        variant: "destructive"
      });
      return;
    }

    // Check memory usage before processing
    const memoryMonitor = new MemoryMonitor();
    const memoryStatus = memoryMonitor.checkMemoryUsage();
    
    if (memoryStatus.critical) {
      toast({
        title: "Memory warning",
        description: "Browser memory is low. Please close other tabs and try again.",
        variant: "destructive"
      });
      return;
    }

    // Warn user for large uploads with estimated time
    if (imageFiles.length > 100) {
      const estimatedTime = optimizer.estimateUploadTime(imageFiles);
      toast({
        title: "Large upload detected",
        description: `Uploading ${imageFiles.length} photos. Estimated time: ${estimatedTime}`,
      });
    }

    // Apply compression if enabled - use queue-based processing
    if (eventCompressionSetting) {
      toast({
        title: "Starting compression queue",
        description: `Adding ${imageFiles.length} images to compression queue for sequential processing...`,
      });

      // Set uploading state to true for auto-upload
      setIsUploading(true);

      // Request wake lock for auto-upload
      if (hasWakeLockSupport) {
        await requestWakeLock();
      }

      // Create compression queue
      const queue = new CompressionUploadQueue(
        async (file: File) => {
          // Upload function for the queue
          const uploadFile: UploadFile = {
            file: file,
            id: `${Date.now()}-${Math.random()}`,
            progress: 0,
            status: 'pending'
          };
          
          updateUploadFiles(prev => [...prev, uploadFile]);
          await uploadPhoto(uploadFile);
        },
        {
          quality: compressionQuality,
          maxWidth: 1920,
          maxHeight: 1080,
          format: imageCompressor.isWebPSupported() ? 'webp' : 'jpeg'
        },
        (stats: CompressionQueueStats) => {
          setQueueStats(stats);
        },
        (item: CompressionQueueItem) => {
          setQueueItems(prev => {
            const index = prev.findIndex(i => i.id === item.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = item;
              return updated;
            } else {
              return [...prev, item];
            }
          });
        }
      );

      setCompressionQueue(queue);

      // Add files to queue
      const newItems = queue.addFiles(imageFiles);
      setQueueItems(newItems);

      // Start processing the queue
      try {
        await queue.startProcessing();
        
        toast({
          title: "Compression queue completed",
          description: `All ${imageFiles.length} images processed and uploaded successfully`,
        });
      } catch (error) {
        console.error('Compression queue error:', error);
        toast({
          title: "Compression queue error",
          description: "Some images may not have been processed correctly",
          variant: "destructive"
        });
      } finally {
        // Reset uploading state and release wake lock
        setIsUploading(false);
        setCompressionQueue(null);
        setQueueItems([]);
        setQueueStats(null);
        await releaseWakeLock();
        
        // Refresh photos after all uploads
        onPhotosUploaded();
      }

    } else {
      // No compression - add all files to upload queue at once
      const newUploadFiles: UploadFile[] = imageFiles.map(file => ({
        file,
        id: `${Date.now()}-${Math.random()}`,
        progress: 0,
        status: 'pending'
      }));

      updateUploadFiles(prev => [...prev, ...newUploadFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files).catch(error => {
      console.error('Error processing files:', error);
      toast({
        title: "Error processing files",
        description: "Failed to process selected files.",
        variant: "destructive"
      });
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files).catch(error => {
      console.error('Error processing files:', error);
      toast({
        title: "Error processing files",
        description: "Failed to process dropped files.",
        variant: "destructive"
      });
    });
  };

  const removeFile = (id: string) => {
    updateUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadPhoto = async (uploadFile: UploadFile): Promise<void> => {
    try {
      // Validate eventId before proceeding
      if (!eventId || eventId === 'undefined') {
        throw new Error('Invalid event ID');
      }

      // Update status to uploading
      updateUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ));

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('photos', uploadFile.file);
      formData.append('eventId', eventId);
      formData.append('filename', uploadFile.file.name);

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            updateUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, progress } : f
            ));
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              
              // Check if this is an async upload response
              if (result.async && result.jobId) {
                // For async uploads, mark as completed but show job status
                updateUploadFiles(prev => prev.map(f => 
                  f.id === uploadFile.id ? { 
                    ...f, 
                    status: 'completed' as const, 
                    jobId: result.jobId,
                    progress: 100 
                  } : f
                ));
                
                // Show async upload notification
                toast({
                  title: "Large upload processing",
                  description: `Your ${result.totalFiles} photos are being processed in the background. Job ID: ${result.jobId}`,
                });
              } else {
                // Normal upload completion
                updateUploadFiles(prev => prev.map(f => 
                  f.id === uploadFile.id ? { 
                    ...f, 
                    status: 'completed' as const, 
                    url: result.url,
                    progress: 100 
                  } : f
                ));
              }
              resolve();
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out'));
        });

        xhr.open('POST', '/api/photos/upload');
        xhr.timeout = 300000; // 5 minute timeout
        xhr.send(formData);
      });

    } catch (error) {
      console.error('Upload error:', error);
      updateUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { 
          ...f, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f
      ));
    }
  };

  const handleUploadAll = async () => {
    if (uploadFiles.length === 0) return;

    setIsUploading(true);
    setDynamicStats(null);
    
    // Request wake lock on mobile to prevent screen from turning off
    if (hasWakeLockSupport) {
      await requestWakeLock();
    }
    
    try {
      const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
      
      
      // Use dynamic upload processing instead of traditional batching
      await uploadQueueManager.startDynamicProcessing(
        pendingFiles,
        uploadPhoto,
        updateUploadFiles,
        (stats) => {
          setDynamicStats(stats);
        },
        `upload_${eventId}_${Date.now()}`
      );

      // Final success/error reporting
      const finalErrorCount = uploadFiles.filter(f => f.status === 'error').length;
      const finalSuccessCount = uploadFiles.filter(f => f.status === 'completed').length;

      if (finalSuccessCount > 0) {
        toast({
          title: "Photos uploaded successfully",
          description: `${finalSuccessCount} photos uploaded to ${eventTitle}`,
        });
        onPhotosUploaded();
      }

      if (finalErrorCount > 0) {
        toast({
          title: "Some uploads failed",
          description: `${finalErrorCount} photos failed to upload`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Upload process error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Upload failed",
        description: `Failed to upload photos: ${errorMessage}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setDynamicStats(null);
      
      // Release wake lock when upload is complete
      await releaseWakeLock();
      
      // Clear persisted state on successful completion
      const allCompleted = uploadFiles.every(f => f.status === 'completed');
      if (allCompleted) {
        clearPersistedState();
      }
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      updateUploadFiles(() => []);
      clearPersistedState();
      setIsOpen(false);
    }
  };

  /**
   * Retry all failed uploads
   */
  const handleRetryAll = async () => {
    const failedFiles = uploadFiles.filter(f => f.status === 'error');
    
    if (failedFiles.length === 0) {
      toast({
        title: "No failed uploads",
        description: "There are no failed uploads to retry.",
        variant: "default"
      });
      return;
    }

    // Reset failed files to pending status
    updateUploadFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f
    ));

    toast({
      title: "Retrying all failed uploads",
      description: `Retrying ${failedFiles.length} failed upload(s).`,
    });

    // Start upload process for the retried files
    await handleUploadAll();
  };

  /**
   * Retry failed uploads (alias for handleRetryAll)
   */
  const handleRetryFailed = handleRetryAll;

  /**
   * Retry a single failed file
   */
  const handleRetrySingle = async (fileId: string) => {
    const file = uploadFiles.find(f => f.id === fileId);
    if (!file || file.status !== 'error') {
      return;
    }

    // Reset file to pending status
    updateUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f
    ));

    toast({
      title: "Retrying upload",
      description: `Retrying ${file.file.name}`,
    });

    // Upload the single file
    try {
      await uploadPhoto(file);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  // Optimize state calculations with useMemo to prevent recalculations on every render
  const uploadStats = useMemo(() => {
    const completed = uploadFiles.filter(f => f.status === 'completed').length;
    const uploading = uploadFiles.filter(f => f.status === 'uploading').length;
    const pending = uploadFiles.filter(f => f.status === 'pending').length;
    const errors = uploadFiles.filter(f => f.status === 'error').length;
    
    return {
      completed,
      uploading,
      pending,
      errors,
      total: uploadFiles.length
    };
  }, [uploadFiles]);

  // Optimize file removal with useCallback
  const optimizedRemoveFile = useCallback((id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // For large uploads, only show a subset of files to prevent UI lag
  const displayFiles = useMemo(() => {
    if (uploadFiles.length <= 20) {
      return uploadFiles;
    }
    
    // For large uploads, prioritize showing:
    // 1. Currently uploading files
    // 2. Failed files (so user can retry)
    // 3. First few completed files
    // 4. First few pending files
    const uploading = uploadFiles.filter(f => f.status === 'uploading');
    const errors = uploadFiles.filter(f => f.status === 'error');
    const completed = uploadFiles.filter(f => f.status === 'completed').slice(0, 5);
    const pending = uploadFiles.filter(f => f.status === 'pending').slice(0, 5);
    
    return [...uploading, ...errors, ...completed, ...pending];
  }, [uploadFiles]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full p-2 flex items-center justify-center">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload Photos to {eventTitle}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              eventCompressionSetting 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {eventCompressionSetting ? '🔄 Compression Enabled' : '📤 Original Quality'}
            </div>
            {eventCompressionSetting && (
              <span className="text-xs text-gray-500">
                Images will be compressed and uploaded automatically
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Compression Settings */}
        {eventCompressionSetting && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-medium text-blue-800">
                  Compression Settings
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompressionSettings(!showCompressionSettings)}
                className="text-blue-600 hover:text-blue-800"
              >
                {showCompressionSettings ? 'Hide' : 'Show'} Settings
              </Button>
            </div>
            
            {showCompressionSettings && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-blue-700">
                      Image Quality: {Math.round(compressionQuality * 100)}%
                    </Label>
                    <span className="text-xs text-blue-600">
                      {compressionQuality === 1.0 ? 'Maximum Quality' : 
                       compressionQuality >= 0.8 ? 'High Quality' :
                       compressionQuality >= 0.6 ? 'Medium Quality' : 'Low Quality'}
                    </span>
                  </div>
                  <Slider
                    value={[compressionQuality]}
                    onValueChange={(value) => setCompressionQuality(value[0])}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-blue-500">
                    <span>10% (Smallest)</span>
                    <span>100% (Original)</span>
                  </div>
                </div>
                
                <div className="text-xs text-blue-600 space-y-1">
                  <p>• Higher quality = larger files, slower uploads</p>
                  <p>• Lower quality = smaller files, faster uploads</p>
                  <p>• Images will be resized to max 1920x1080 pixels</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Upload Area */}
          <Card 
            className={`border-2 border-dashed transition-colors cursor-pointer ${
              isDragOver 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Upload className={`h-12 w-12 mb-4 ${
                isDragOver ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isDragOver ? 'Drop photos here' : 'Drop photos here or click to browse'}
              </h3>
              <p className="text-gray-600 text-center">
                Support for JPG, PNG, WebP files<br />
                Maximum 200 photos per upload (optimized for large batches)
              </p>
              
              {/* Mobile Upload Protection Notice */}
              {hasWakeLockSupport && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm font-medium">Mobile Upload Protection</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Your uploads will be protected from interruptions and can auto-resume if the screen locks
                  </p>
                </div>
              )}
              <Button className="mt-4" variant="outline">
                <FileImage className="h-4 w-4 mr-2" />
                Select Photos
              </Button>
            </CardContent>
          </Card>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            aria-label="Select photos to upload"
          />


          {/* Upload Progress */}
          {uploadFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium">
                    Photos ({uploadStats.completed}/{uploadStats.total})
                  </h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    eventCompressionSetting 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {eventCompressionSetting ? '🔄 Auto-Upload' : '📤 Manual Upload'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {uploadStats.total > 20 && (
                    <Badge variant="outline" className="text-xs">
                      Showing key files only
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleUploadAll}
                    disabled={isUploading || uploadFiles.every(f => f.status !== 'pending')}
                  >
                    {isUploading ? 'Uploading...' : eventCompressionSetting ? 'Upload Remaining' : 'Upload All'}
                  </Button>
                  
                  {/* Retry All Button - Only show when there are failed uploads */}
                  {uploadStats.errors > 0 && (
                    <Button
                      onClick={handleRetryAll}
                      disabled={isUploading}
                      className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600 font-medium"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry All Failed ({uploadStats.errors})
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => updateUploadFiles(() => [])}
                    disabled={isUploading}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Overall Progress Bar for Large Uploads */}
              {uploadStats.total > 5 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span>{uploadStats.completed}/{uploadStats.total}</span>
                  </div>
                  <Progress 
                    value={(uploadStats.completed / uploadStats.total) * 100} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{uploadStats.uploading} uploading</span>
                    <span className={uploadStats.errors > 0 ? "text-orange-600 font-medium" : ""}>
                      {uploadStats.errors} failed
                    </span>
                    <span>{uploadStats.pending} pending</span>
                  </div>
                  
                  {/* Retry Available Indicator */}
                  {uploadStats.errors > 0 && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-orange-700">
                        <RotateCcw className="h-4 w-4" />
                        <span className="font-medium">
                          {uploadStats.errors} upload{uploadStats.errors > 1 ? 's' : ''} failed
                        </span>
                        <span className="text-orange-600">
                          - Use "Retry All" button to attempt upload again
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Dynamic Upload Stats */}
                  {dynamicStats && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="text-blue-700 font-medium">
                            Dynamic Processing: {dynamicStats.completed}/{dynamicStats.total}
                          </span>
                          <span className="text-blue-600">
                            {dynamicStats.uploading} active
                          </span>
                          <span className="text-blue-600">
                            {dynamicStats.throughput.toFixed(1)} files/sec
                          </span>
                        </div>
                        <div className="text-xs text-blue-500">
                          {dynamicStats.pending} pending
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compression Queue Stats */}
                  {queueStats && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="text-green-700 font-medium">
                            Compression Queue: {queueStats.completed}/{queueStats.total}
                          </span>
                          <span className="text-green-600">
                            {queueStats.compressing} compressing
                          </span>
                          <span className="text-green-600">
                            {queueStats.uploading} uploading
                          </span>
                        </div>
                        <div className="text-xs text-green-500">
                          {queueStats.pending} pending
                        </div>
                      </div>
                      {queueStats.currentItem && (
                        <div className="mt-2 text-xs text-green-600">
                          Processing: {queueStats.currentItem.originalFile.name}
                          {queueStats.currentItem.status === 'compressing' && ' (compressing...)'}
                          {queueStats.currentItem.status === 'uploading' && ' (uploading...)'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mobile Upload Status */}
                  {isUploading && wakeLock && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-700 font-medium">
                        Screen lock prevented - Upload protected from interruptions
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* File List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {displayFiles.map((uploadFile) => (
                  <Card key={uploadFile.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <FileImage className="h-8 w-8 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {uploadFile.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          
                          {uploadFile.status === 'uploading' && (
                            <Progress value={uploadFile.progress} className="mt-2" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {uploadFile.status === 'pending' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {uploadFile.status === 'uploading' && (
                            <Badge className="bg-blue-100 text-blue-800">Uploading</Badge>
                          )}
                          {uploadFile.status === 'completed' && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {uploadFile.status === 'error' && (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                          
                          {!isUploading && uploadFile.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => optimizedRemoveFile(uploadFile.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {!isUploading && uploadFile.status === 'error' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetrySingle(uploadFile.id)}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              title="Retry this upload"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {uploadFile.status === 'error' && uploadFile.error && (
                        <p className="text-xs text-red-600 mt-2">{uploadFile.error}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center border-t pt-4">
            {/* Retry All Button - Bottom section */}
            {uploadStats.errors > 0 && (
              <Button
                onClick={handleRetryAll}
                disabled={isUploading}
                className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600 font-medium"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry All Failed ({uploadStats.errors})
              </Button>
            )}
            
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}