import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, FolderOpen, Play, Square, Upload, AlertCircle, CheckCircle, X, Camera, FileImage, ChevronRight, Home, Smartphone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MonitoredFolder {
  directoryHandle?: FileSystemDirectoryHandle;
  folderPath?: string;
  folderName: string;
  eventId: string;
  eventName: string;
  isActive: boolean;
  filesProcessed: number;
  createdAt: Date;
  monitorType: 'api' | 'server';
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export default function FolderMonitor() {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [monitoredFolders, setMonitoredFolders] = useState<MonitoredFolder[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [folderSelectionTab, setFolderSelectionTab] = useState('browse');
  const [manualPath, setManualPath] = useState('');
  const [currentBrowsePath, setCurrentBrowsePath] = useState('');
  const [browseItems, setBrowseItems] = useState<any[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const monitoringInterval = useRef<NodeJS.Timeout | null>(null);
  const processedFiles = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // Check if File System Access API is supported
  const isFileSystemAccessSupported = 'showDirectoryPicker' in window;

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await currentUser.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  // Query events for event selection
  const { data: events = [] } = useQuery({
    queryKey: ['/api/admin/events'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/admin/events');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Browse folders mutation for server-side browsing
  const browseFoldersMutation = useMutation({
    mutationFn: async (path: string) => {
      const response = await makeAuthenticatedRequest('/api/folder-monitor/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPath: path }),
      });
      if (!response.ok) throw new Error('Failed to browse folders');
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentBrowsePath(data.currentPath);
      setBrowseItems(data.items);
    },
    onError: (error) => {
      toast.error('Failed to browse folder: ' + (error as any).message);
    }
  });

  // Validate folder path mutation
  const validateFolderMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      const response = await makeAuthenticatedRequest('/api/folder-monitor/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      if (!response.ok) throw new Error('Failed to validate folder');
      return response.json();
    },
  });

  // Start server-side monitoring mutation
  const startServerMonitoringMutation = useMutation({
    mutationFn: async ({ folderPath, eventId }: { folderPath: string; eventId: string }) => {
      const response = await makeAuthenticatedRequest('/api/folder-monitor/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, eventId }),
      });
      if (!response.ok) throw new Error('Failed to start monitoring');
      return response.json();
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, eventId, fileName }: { file: File; eventId: string; fileName: string }) => {
      const formData = new FormData();
      formData.append('photos', file);
      formData.append('eventId', eventId);

      const response = await makeAuthenticatedRequest(`/api/photos/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }
      return response.json();
    },
    onError: (error: any, variables) => {
      setUploadProgress(prev => 
        prev.map(p => 
          p.fileName === variables.fileName 
            ? { ...p, status: 'error', error: error.message }
            : p
        )
      );
    }
  });

  // Initialize browsing with common mobile paths
  const initializeBrowsing = async () => {
    setIsBrowsing(true);
    // Start with mobile-friendly default paths
    const defaultPaths = [
      '/storage/emulated/0/DCIM/Canon',
      '/storage/emulated/0/Pictures/Canon',
      '/storage/emulated/0/Download/Canon',
      '/sdcard/DCIM/Canon',
      '/sdcard/Pictures/Canon',
      '.'
    ];

    let initialPath = '.';
    for (const path of defaultPaths) {
      try {
        await browseFoldersMutation.mutateAsync(path);
        initialPath = path;
        break;
      } catch {
        continue;
      }
    }

    if (browseItems.length === 0) {
      await browseFoldersMutation.mutateAsync(initialPath);
    }
    setIsBrowsing(false);
  };

  // Browse to a specific folder
  const handleBrowseFolder = async (folderPath: string) => {
    setIsBrowsing(true);
    await browseFoldersMutation.mutateAsync(folderPath);
    setIsBrowsing(false);
  };

  // Handle manual path validation and setup
  const handleManualPathSetup = async () => {
    if (!selectedEventId) {
      toast.error('Please select an event first');
      return;
    }

    if (!manualPath.trim()) {
      toast.error('Please enter a folder path');
      return;
    }

    try {
      const validation = await validateFolderMutation.mutateAsync(manualPath.trim());
      
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      // Start server-side monitoring
      await startServerMonitoringMutation.mutateAsync({
        folderPath: validation.folderPath,
        eventId: selectedEventId,
      });

      const event = events.find((e: any) => e.id === selectedEventId);
      const folderName = validation.folderPath.split('/').pop() || 'Unknown Folder';

      const newFolder: MonitoredFolder = {
        folderPath: validation.folderPath,
        folderName,
        eventId: selectedEventId,
        eventName: event?.title || 'Unknown Event',
        isActive: true,
        filesProcessed: 0,
        createdAt: new Date(),
        monitorType: 'server'
      };

      setMonitoredFolders(prev => [...prev, newFolder]);
      setSetupDialogOpen(false);
      setSelectedEventId('');
      setManualPath('');
      
      toast.success(`Started monitoring folder: ${folderName} (${validation.imageCount} existing images)`);
    } catch (error) {
      toast.error('Failed to setup folder monitoring: ' + (error as any).message);
    }
  };

  // Handle browsed folder selection
  const handleSelectBrowsedFolder = async () => {
    if (!selectedEventId) {
      toast.error('Please select an event first');
      return;
    }

    if (!currentBrowsePath) {
      toast.error('No folder selected');
      return;
    }

    try {
      const validation = await validateFolderMutation.mutateAsync(currentBrowsePath);
      
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      // Start server-side monitoring
      await startServerMonitoringMutation.mutateAsync({
        folderPath: validation.folderPath,
        eventId: selectedEventId,
      });

      const event = events.find((e: any) => e.id === selectedEventId);
      const folderName = validation.folderPath.split('/').pop() || 'Unknown Folder';

      const newFolder: MonitoredFolder = {
        folderPath: validation.folderPath,
        folderName,
        eventId: selectedEventId,
        eventName: event?.title || 'Unknown Event',
        isActive: true,
        filesProcessed: 0,
        createdAt: new Date(),
        monitorType: 'server'
      };

      setMonitoredFolders(prev => [...prev, newFolder]);
      setSetupDialogOpen(false);
      setSelectedEventId('');
      
      toast.success(`Started monitoring folder: ${folderName} (${validation.imageCount} existing images)`);
    } catch (error) {
      toast.error('Failed to setup folder monitoring: ' + (error as any).message);
    }
  };

  // Select folder using File System Access API (legacy method)
  const handleSelectFolder = async () => {
    if (!isFileSystemAccessSupported) {
      toast.error('File System Access API is not supported in this browser. Please use the alternative folder selection methods.');
      return;
    }

    if (!selectedEventId) {
      toast.error('Please select an event first');
      return;
    }

    try {
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      const event = events.find((e: any) => e.id === selectedEventId);
      if (!event) {
        toast.error('Selected event not found');
        return;
      }

      const newFolder: MonitoredFolder = {
        directoryHandle,
        folderName: directoryHandle.name,
        eventId: selectedEventId,
        eventName: event.title,
        isActive: true,
        filesProcessed: 0,
        createdAt: new Date(),
        monitorType: 'api'
      };

      setMonitoredFolders(prev => [...prev, newFolder]);
      setSetupDialogOpen(false);
      setSelectedEventId('');
      
      // Start monitoring if not already running
      if (!isMonitoring) {
        startMonitoring();
      }

      toast.success(`Started monitoring Canon Connect folder: ${directoryHandle.name}`);
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        toast.error('Failed to select folder: ' + (error as any).message);
      }
    }
  };

  // Start the monitoring process
  const startMonitoring = () => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    
    monitoringInterval.current = setInterval(async () => {
      await checkForNewFiles();
    }, 5000); // Check every 5 seconds

    toast.success('Canon Connect monitoring started');
  };

  // Stop monitoring
  const stopMonitoring = () => {
    if (monitoringInterval.current) {
      clearInterval(monitoringInterval.current);
      monitoringInterval.current = null;
    }
    setIsMonitoring(false);
    toast.success('Canon Connect monitoring stopped');
  };

  // Check for new files in monitored folders
  const checkForNewFiles = async () => {
    for (const folder of monitoredFolders) {
      if (!folder.isActive) continue;

      try {
        if (folder.monitorType === 'api' && folder.directoryHandle) {
          await scanDirectoryForNewFiles(folder.directoryHandle, folder);
        }
        // Server-side monitoring is handled by the backend automatically
      } catch (error) {
        console.error('Error scanning directory:', error);
      }
    }
  };

  // Recursively scan directory for new image files (API-based monitoring only)
  const scanDirectoryForNewFiles = async (directoryHandle: FileSystemDirectoryHandle, folder: MonitoredFolder) => {
    try {
      for await (const [name, handle] of (directoryHandle as any).entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          const fileKey = `${directoryHandle.name}/${name}_${file.lastModified}`;
          
          // Check if this file has already been processed
          if (processedFiles.current.has(fileKey)) {
            continue;
          }

          // Check if it's an image file
          if (isImageFile(file)) {
            processedFiles.current.add(fileKey);
            await uploadFile(file, folder.eventId, name);
            
            // Update processed count
            setMonitoredFolders(prev => 
              prev.map(f => 
                f.directoryHandle === folder.directoryHandle 
                  ? { ...f, filesProcessed: f.filesProcessed + 1 }
                  : f
              )
            );
          }
        } else if (handle.kind === 'directory') {
          // Recursively scan subdirectories
          await scanDirectoryForNewFiles(handle, folder);
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
  };

  // Check if file is an image
  const isImageFile = (file: File): boolean => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp'];
    return imageTypes.includes(file.type.toLowerCase()) || 
           /\.(jpe?g|png|gif|webp|tiff?|bmp)$/i.test(file.name);
  };

  // Upload a single file
  const uploadFile = async (file: File, eventId: string, fileName: string) => {
    // Add to progress tracking
    setUploadProgress(prev => [...prev, {
      fileName,
      progress: 0,
      status: 'uploading'
    }]);

    try {
      await uploadFileMutation.mutateAsync({ file, eventId, fileName });
      
      // Update progress to complete
      setUploadProgress(prev => 
        prev.map(p => 
          p.fileName === fileName 
            ? { ...p, progress: 100, status: 'complete' }
            : p
        )
      );

      // Remove from progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(p => p.fileName !== fileName));
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // Remove a folder from monitoring
  const removeFolder = (index: number) => {
    setMonitoredFolders(prev => {
      const updated = prev.filter((_, i) => i !== index);
      
      // Stop monitoring if no folders left
      if (updated.length === 0 && isMonitoring) {
        stopMonitoring();
      }
      
      return updated;
    });
  };

  // Toggle folder monitoring
  const toggleFolderActive = (index: number) => {
    setMonitoredFolders(prev => 
      prev.map((folder, i) => 
        i === index ? { ...folder, isActive: !folder.isActive } : folder
      )
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringInterval.current) {
        clearInterval(monitoringInterval.current);
      }
    };
  }, []);



  return (
    <div className="space-y-6">
      {/* Canon Connect Integration Info */}
      <Alert className="border-blue-200 bg-blue-50">
        <Camera className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium text-blue-800">Canon Connect Auto Transfer Integration</p>
            <p className="text-blue-700">
              Connect your Canon R10 to your mobile device via Canon Connect app with auto transfer enabled. 
              Then select the folder where Canon Connect saves transferred images to automatically upload them to events.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Browser Compatibility Check */}
      {!isFileSystemAccessSupported && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Limited browser support detected</strong></p>
              <p>The native file picker requires Chrome/Edge. Use the "Browse" or "Manual Path" methods instead for full compatibility.</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Canon Connect Auto Transfer Setup Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Canon Connect Auto Transfer
              </CardTitle>
              <CardDescription>
                Monitor Canon Connect's auto transfer folder for automatic event uploads
              </CardDescription>
            </div>
            {isMonitoring && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Monitoring Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Camera className="w-4 h-4 mr-2" />
                  Setup Canon Connect Auto Transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Setup Canon Connect Auto Transfer</DialogTitle>
                  <DialogDescription>
                    Connect your Canon Connect app's auto transfer folder to automatically upload photos to events
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Setup Steps:</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Connect Canon R10 to mobile via Canon Connect app</li>
                      <li>Enable "Auto Transfer" in Canon Connect settings</li>
                      <li>Take photos with your Canon R10</li>
                      <li>Photos automatically transfer to your mobile device</li>
                      <li>Select the Canon Connect folder below to monitor for uploads</li>
                    </ol>
                  </div>
                  
                  {/* Event Selection */}
                  <div className="space-y-2">
                    <Label>Target Event</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select event for uploads" />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((event: any) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Folder Selection Methods */}
                  <Tabs value={folderSelectionTab} onValueChange={setFolderSelectionTab}>
                    <TabsList className={`grid w-full ${isFileSystemAccessSupported ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <TabsTrigger value="browse" className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Browse
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="flex items-center gap-2">
                        <FileImage className="w-4 h-4" />
                        Manual Path
                      </TabsTrigger>
                      {isFileSystemAccessSupported && (
                        <TabsTrigger value="native" className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4" />
                          File Picker
                        </TabsTrigger>
                      )}
                    </TabsList>

                    {/* Browse Folders Tab - Mobile Friendly */}
                    <TabsContent value="browse" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Browse Folders</Label>
                        <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
                          {!currentBrowsePath && (
                            <div className="text-center py-4">
                              <Button 
                                onClick={initializeBrowsing}
                                disabled={isBrowsing}
                                variant="outline"
                              >
                                {isBrowsing ? 'Loading...' : 'Start Browsing'}
                              </Button>
                              <p className="text-sm text-gray-500 mt-2">
                                Will search for common Canon Connect folders
                              </p>
                            </div>
                          )}
                          
                          {currentBrowsePath && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Home className="w-4 h-4" />
                                {currentBrowsePath}
                              </div>
                              <div className="space-y-1">
                                {browseItems.map((item, index) => (
                                  <div 
                                    key={index}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    onClick={() => handleBrowseFolder(item.fullPath)}
                                  >
                                    <Folder className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm">{item.name}</span>
                                    <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                                  </div>
                                ))}
                                {browseItems.length === 0 && (
                                  <p className="text-sm text-gray-500 p-2">No folders found</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleSelectBrowsedFolder}
                        disabled={!selectedEventId || !currentBrowsePath}
                        className="w-full"
                      >
                        <Folder className="w-4 h-4 mr-2" />
                        Select Current Folder
                      </Button>
                    </TabsContent>

                    {/* Manual Path Input Tab */}
                    <TabsContent value="manual" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Folder Path</Label>
                        <Input
                          placeholder="/storage/emulated/0/DCIM/Canon"
                          value={manualPath}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualPath(e.target.value)}
                        />
                        <div className="text-xs text-gray-500 space-y-1">
                          <p><strong>Common Canon Connect paths:</strong></p>
                          <p>• /storage/emulated/0/DCIM/Canon</p>
                          <p>• /storage/emulated/0/Pictures/Canon</p>
                          <p>• /storage/emulated/0/Download/Canon</p>
                          <p>• /sdcard/DCIM/Canon</p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleManualPathSetup}
                        disabled={!selectedEventId || !manualPath.trim() || validateFolderMutation.isPending}
                        className="w-full"
                      >
                        {validateFolderMutation.isPending ? (
                          'Validating...'
                        ) : (
                          <>
                            <FileImage className="w-4 h-4 mr-2" />
                            Setup Folder Monitoring
                          </>
                        )}
                      </Button>
                    </TabsContent>

                    {/* Native File Picker Tab */}
                    {isFileSystemAccessSupported && (
                      <TabsContent value="native" className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">
                            Use your browser's native folder picker (Chrome/Edge only)
                          </p>
                        </div>
                        
                        <Button 
                          onClick={handleSelectFolder}
                          disabled={!selectedEventId}
                          className="w-full"
                        >
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Select Canon Connect Folder
                        </Button>
                      </TabsContent>
                    )}
                  </Tabs>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• The system will monitor the selected folder and automatically upload new photos</p>
                    <p>• Server-side monitoring works even when this browser tab is closed</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {monitoredFolders.length > 0 && (
              <div className="flex gap-2">
                {!isMonitoring ? (
                  <Button onClick={startMonitoring} variant="outline">
                    <Play className="w-4 h-4 mr-2" />
                    Start Monitoring
                  </Button>
                ) : (
                  <Button onClick={stopMonitoring} variant="outline">
                    <Square className="w-4 h-4 mr-2" />
                    Stop Monitoring
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Progress
            </CardTitle>
            <CardDescription>
              Files currently being processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadProgress.map((progress, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <FileImage className="w-4 h-4" />
                      {progress.fileName}
                    </span>
                    <Badge 
                      variant={
                        progress.status === 'complete' ? 'default' : 
                        progress.status === 'error' ? 'destructive' : 'secondary'
                      }
                    >
                      {progress.status === 'uploading' && 'Uploading'}
                      {progress.status === 'processing' && 'Processing'}
                      {progress.status === 'complete' && 'Complete'}
                      {progress.status === 'error' && 'Error'}
                    </Badge>
                  </div>
                  {progress.status !== 'error' && (
                    <Progress value={progress.progress} className="h-2" />
                  )}
                  {progress.error && (
                    <p className="text-xs text-red-600">{progress.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Monitors */}
      <Card>
        <CardHeader>
          <CardTitle>Canon Connect Auto Transfer Status</CardTitle>
          <CardDescription>
            Currently monitoring {monitoredFolders.length} Canon Connect folder{monitoredFolders.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monitoredFolders.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No Canon Connect folders are being monitored. Setup auto transfer to automatically upload photos from your Canon R10.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {monitoredFolders.map((folder, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={folder.isActive ? "outline" : "secondary"} 
                        className={folder.isActive ? "text-green-600 border-green-600" : ""}
                      >
                        {folder.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <Square className="w-3 h-3 mr-1" />
                            Paused
                          </>
                        )}
                      </Badge>
                      <span className="font-medium">
                        {folder.folderName}
                      </span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {folder.monitorType === 'api' ? 'Browser' : 'Server'}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Event: {folder.eventName}</div>
                      {folder.folderPath && <div>Path: {folder.folderPath}</div>}
                      <div>Files processed: {folder.filesProcessed}</div>
                      <div>Added: {folder.createdAt.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFolderActive(index)}
                    >
                      {folder.isActive ? (
                        <>
                          <Square className="w-4 h-4 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          Resume
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFolder(index)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div>
              <div className="font-medium">Connect Canon R10 to mobile</div>
              <div className="text-sm text-gray-600">
                Use Canon Connect app with wired connection to your mobile device
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <div className="font-medium">Enable auto transfer in Canon Connect</div>
              <div className="text-sm text-gray-600">
                Set up automatic transfer of photos from camera to mobile device
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <div className="font-medium">Select Canon Connect folder</div>
              <div className="text-sm text-gray-600">
                Choose the folder where Canon Connect saves transferred photos
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              4
            </div>
            <div>
              <div className="font-medium">Automatic upload and processing</div>
              <div className="text-sm text-gray-600">
                New photos are automatically uploaded to events and processed for face recognition
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Camera className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-green-800">Canon Connect Workflow Benefits:</div>
                <ul className="mt-1 text-green-700 space-y-1">
                  <li>• Photos transfer automatically from Canon R10 to mobile</li>
                  <li>• No manual file handling or USB connections needed</li>
                  <li>• Seamless integration with existing Canon Connect setup</li>
                  <li>• Continue shooting while photos upload in background</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">Technical Requirements:</div>
                <ul className="mt-1 text-yellow-700 space-y-1">
                  <li>• Keep this browser tab open for monitoring to work</li>
                  <li>• Monitoring pauses when computer goes to sleep</li>
                  <li>• Only works in Chrome, Edge, and Chromium-based browsers</li>
                  <li>• Canon Connect app must be set to auto transfer</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}