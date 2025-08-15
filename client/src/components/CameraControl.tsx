import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Wifi, WifiOff, Settings, Download, Trash2, Upload, Activity, AlertCircle, CheckCircle, Usb, Cable } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface CameraInfo {
  productname: string;
  serialnumber: string;
  firmwareversion: string;
  battery?: {
    level: number;
    kind: string;
  };
}

interface CameraStatus {
  connected: boolean;
  type?: 'wireless' | 'usb';
  ip?: string;
  port?: number;
  transferSettings: {
    autoTransfer: boolean;
    eventId?: string;
    quality: 'original' | 'compressed';
    deleteAfterTransfer: boolean;
  };
  timestamp: string;
}

interface CameraImage {
  name: string;
  url: string;
  size: number;
  timestamp: string;
}

export default function CameraControl() {
  const [cameraIP, setCameraIP] = useState('');
  const [cameraPort, setCameraPort] = useState('8080');
  const [connectionType, setConnectionType] = useState<'wireless' | 'usb'>('wireless');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await currentUser.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  // Query camera status
  const { data: cameraStatus, refetch: refetchStatus } = useQuery<CameraStatus>({
    queryKey: ['/api/camera/status'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/camera/status');
      if (!response.ok) {
        throw new Error(`Failed to fetch camera status: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: !!currentUser, // Only run when user is authenticated
  });

  // Query camera info
  const { data: cameraInfo } = useQuery<{ info: CameraInfo; status: any }>({
    queryKey: ['/api/camera/info'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/camera/info');
      if (!response.ok) {
        throw new Error(`Failed to fetch camera info: ${response.status}`);
      }
      return response.json();
    },
    enabled: (cameraStatus?.connected && !!currentUser) || false,
    refetchInterval: 10000, // Refresh every 10 seconds if connected
  });

  // Query camera images
  const { data: cameraImages = [] } = useQuery<CameraImage[]>({
    queryKey: ['/api/camera/images'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/camera/images');
      if (!response.ok) {
        throw new Error(`Failed to fetch camera images: ${response.status}`);
      }
      return response.json();
    },
    enabled: (cameraStatus?.connected && !!currentUser) || false,
    refetchInterval: 5000, // Refresh every 5 seconds if connected
  });

  // Query events for event selection
  const { data: events = [] } = useQuery({
    queryKey: ['/api/admin/events'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/admin/events');
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!currentUser, // Only run when user is authenticated
  });

  // Connect to camera mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const endpoint = connectionType === 'usb' ? '/api/camera/connect-usb' : '/api/camera/connect';
      const body = connectionType === 'usb' ? {} : { 
        ip: cameraIP, 
        port: parseInt(cameraPort),
        type: connectionType 
      };
      
      const response = await makeAuthenticatedRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || `Connected via ${connectionType}`);
      queryClient.invalidateQueries({ queryKey: ['/api/camera/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/camera/info'] });
    },
    onError: (error: any) => {
      toast.error(error.message || `Failed to connect via ${connectionType}`);
    }
  });

  // Disconnect from camera mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await makeAuthenticatedRequest('/api/camera/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Disconnected from camera');
      queryClient.invalidateQueries({ queryKey: ['/api/camera/status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disconnect from camera');
    }
  });

  // Take picture mutation
  const captureMutation = useMutation({
    mutationFn: async () => {
      const response = await makeAuthenticatedRequest('/api/camera/capture', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to take picture');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Picture taken successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/camera/images'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to take picture');
    }
  });

  // Update transfer settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await makeAuthenticatedRequest('/api/camera/transfer-settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Transfer settings updated');
      queryClient.invalidateQueries({ queryKey: ['/api/camera/status'] });
      setSettingsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update settings');
    }
  });

  // Download image mutation
  const downloadImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await makeAuthenticatedRequest(`/api/camera/download/${imageUrl.substring(1)}`, {
        method: 'POST',
        body: JSON.stringify({ eventId: selectedEventId || cameraStatus?.transferSettings.eventId }),
      });
      if (!response.ok) throw new Error('Failed to download image');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Image downloaded successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/camera/images'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to download image');
    }
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await makeAuthenticatedRequest(`/api/camera/images/${imageUrl.substring(1)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete image');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Image deleted from camera');
      queryClient.invalidateQueries({ queryKey: ['/api/camera/images'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete image');
    }
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await makeAuthenticatedRequest('/api/camera/test-connection', {
        method: 'POST',
        body: JSON.stringify({ 
          ip: cameraIP, 
          port: parseInt(cameraPort) 
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Connection test failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Connection test successful');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Connection test failed');
    }
  });

  const handleUpdateSettings = (settings: any) => {
    updateSettingsMutation.mutate(settings);
  };

  const isConnected = cameraStatus?.connected || false;

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Canon R10 Camera Control
          </CardTitle>
          <CardDescription>
            Connect and control your Canon R10 camera with auto transfer capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  {cameraStatus?.type === 'usb' ? (
                    <Usb className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Wifi className="w-4 h-4 text-green-600" />
                  )}
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Connected via {cameraStatus?.type?.toUpperCase() || 'Unknown'}
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <Badge variant="outline" className="text-gray-600 border-gray-400">
                    Disconnected
                  </Badge>
                </>
              )}
            </div>
            
            {isConnected && cameraStatus?.type === 'wireless' && (
              <div className="text-sm text-gray-500">
                {cameraStatus.ip}:{cameraStatus.port}
              </div>
            )}

            {isConnected && cameraStatus?.type === 'usb' && (
              <div className="text-sm text-gray-500">
                USB Connected
              </div>
            )}
            
            <div className="flex gap-2">
              {!isConnected ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Wifi className="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Connect to Canon R10</DialogTitle>
                      <DialogDescription>
                        Choose between USB or wireless connection to your Canon R10 camera.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Connection Type Selector */}
                      <div className="space-y-2">
                        <Label>Connection Type</Label>
                        <Select value={connectionType} onValueChange={(value: 'wireless' | 'usb') => setConnectionType(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usb">
                              <div className="flex items-center gap-2">
                                <Usb className="h-4 w-4" />
                                USB Connection
                              </div>
                            </SelectItem>
                            <SelectItem value="wireless">
                              <div className="flex items-center gap-2">
                                <Wifi className="h-4 w-4" />
                                Wireless Connection
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {connectionType === 'wireless' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="camera-ip">Camera IP Address</Label>
                            <Input
                              id="camera-ip"
                              placeholder="e.g., 192.168.1.100"
                              value={cameraIP}
                              onChange={(e) => setCameraIP(e.target.value)}
                            />
                            <p className="text-xs text-gray-500">
                              Find this in your camera: Menu → Communication → Wi-Fi/Bluetooth → Wi-Fi Settings
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="camera-port">Port</Label>
                            <Input
                              id="camera-port"
                              placeholder="8080"
                              value={cameraPort}
                              onChange={(e) => setCameraPort(e.target.value)}
                            />
                          </div>
                          
                          {/* Test Connection Button */}
                          <Button 
                            onClick={() => testConnectionMutation.mutate()}
                            disabled={testConnectionMutation.isPending || !cameraIP?.trim()}
                            variant="outline"
                            className="w-full mb-2"
                          >
                            {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                          </Button>

                          {/* Troubleshooting Guide */}
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="space-y-2">
                              <div className="font-semibold">Connection Troubleshooting:</div>
                              <div className="text-sm space-y-1">
                                <div>• Ensure Canon R10 Wi-Fi is enabled and connected to same network</div>
                                <div>• Enable Remote Control in Camera: Menu → Communication → Remote Control</div>
                                <div>• Check camera's IP address in Wi-Fi settings</div>
                                <div>• Ensure CCAPI service is running (camera shows "Connected" status)</div>
                                <div>• Current IP being tested: <span className="font-mono">{cameraStatus?.ip || 'None'}</span></div>
                                <div>• Try connecting camera to a mobile hotspot if network issues persist</div>
                              </div>
                            </AlertDescription>
                          </Alert>
                        </>
                      )}

                      {connectionType === 'usb' && (
                        <Alert>
                          <Cable className="h-4 w-4" />
                          <AlertDescription>
                            Connect your Canon R10 via USB cable and ensure CCAPI is enabled in camera settings under Communication → Wi-Fi/Bluetooth settings.
                          </AlertDescription>
                        </Alert>
                      )}
                      <Button 
                        onClick={() => connectMutation.mutate()}
                        disabled={connectMutation.isPending || (connectionType === 'wireless' && !cameraIP?.trim())}
                        className="w-full"
                      >
                        {connectionType === 'usb' ? (
                          <Usb className="h-4 w-4 mr-2" />
                        ) : (
                          <Wifi className="h-4 w-4 mr-2" />
                        )}
                        {connectMutation.isPending 
                          ? 'Connecting...' 
                          : `Connect via ${connectionType === 'usb' ? 'USB' : 'WiFi'}`
                        }
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button 
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  variant="outline" 
                  size="sm"
                >
                  <WifiOff className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* Camera Info */}
          {isConnected && cameraInfo && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Model:</span> {cameraInfo.info.productname}
                </div>
                <div>
                  <span className="font-medium">Serial:</span> {cameraInfo.info.serialnumber}
                </div>
                <div>
                  <span className="font-medium">Firmware:</span> {cameraInfo.info.firmwareversion}
                </div>
                {cameraInfo.info.battery && (
                  <div>
                    <span className="font-medium">Battery:</span> {cameraInfo.info.battery.level}%
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto Transfer Settings */}
          {isConnected && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium">Auto Transfer</h4>
                  <p className="text-sm text-gray-600">Automatically transfer photos from camera</p>
                </div>
                <div className="flex items-center gap-2">
                  {cameraStatus?.transferSettings.autoTransfer && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Activity className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                  <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-1" />
                        Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Auto Transfer Settings</DialogTitle>
                        <DialogDescription>
                          Configure how photos are automatically transferred from your camera
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="auto-transfer">Enable Auto Transfer</Label>
                          <Switch
                            id="auto-transfer"
                            checked={cameraStatus?.transferSettings.autoTransfer || false}
                            onCheckedChange={(checked) => 
                              handleUpdateSettings({ autoTransfer: checked })
                            }
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="event-select">Transfer to Event</Label>
                          <Select 
                            value={cameraStatus?.transferSettings.eventId || ''}
                            onValueChange={(value) => 
                              handleUpdateSettings({ eventId: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select event (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No specific event</SelectItem>
                              {Array.isArray(events) && events.map((event: any) => (
                                <SelectItem key={event.id} value={event.id}>
                                  {event.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="quality-select">Image Quality</Label>
                          <Select 
                            value={cameraStatus?.transferSettings.quality || 'compressed'}
                            onValueChange={(value) => 
                              handleUpdateSettings({ quality: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="original">Original Quality</SelectItem>
                              <SelectItem value="compressed">Compressed (85% JPEG)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="delete-after">Delete from camera after transfer</Label>
                          <Switch
                            id="delete-after"
                            checked={cameraStatus?.transferSettings.deleteAfterTransfer || false}
                            onCheckedChange={(checked) => 
                              handleUpdateSettings({ deleteAfterTransfer: checked })
                            }
                          />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          )}

          {/* Camera Controls */}
          {isConnected && (
            <div className="border-t pt-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => captureMutation.mutate()}
                  disabled={captureMutation.isPending}
                  className="flex-1"
                >
                  <Camera className="w-4 h-4 mr-1" />
                  {captureMutation.isPending ? 'Taking Picture...' : 'Take Picture'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camera Images */}
      {isConnected && cameraImages && cameraImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Images on Camera ({cameraImages.length})
            </CardTitle>
            <CardDescription>
              Manage photos stored on your camera
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.isArray(events) && events.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="batch-event-select">Download to Event</Label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger className="max-w-sm">
                      <SelectValue placeholder="Select event for downloads" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">General uploads</SelectItem>
                      {events.map((event: any) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid gap-2">
                {Array.isArray(cameraImages) && cameraImages.slice(0, 10).map((image) => (
                  <div key={image.url} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{image.name}</p>
                      <p className="text-sm text-gray-500">
                        {(image.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadImageMutation.mutate(image.url)}
                        disabled={downloadImageMutation.isPending}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteImageMutation.mutate(image.url)}
                        disabled={deleteImageMutation.isPending}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {cameraImages.length > 10 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Showing first 10 images. {cameraImages.length - 10} more available.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      {!isConnected && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Setup Instructions:</strong><br />
            1. Enable CCAPI on your Canon R10 camera (Camera Settings → Network → Camera Control API)<br />
            2. Connect your camera to the same Wi-Fi network as this device<br />
            3. Note the IP address displayed on your camera screen<br />
            4. Click "Connect" and enter the camera's IP address
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}