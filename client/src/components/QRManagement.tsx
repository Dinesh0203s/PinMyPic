import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, Eye, Trash2, Plus, Clock, Users, Calendar, ExternalLink } from 'lucide-react';
import { Event, QRCode as QRCodeType } from "@shared/types";
import { useAuth } from '@/contexts/AuthContext';

interface QRManagementProps {}

const QRManagement: React.FC<QRManagementProps> = () => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expirationHours, setExpirationHours] = useState("24");
  const [maxUsage, setMaxUsage] = useState("");
  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [viewQRDialogOpen, setViewQRDialogOpen] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState<QRCodeType | null>(null);
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // Custom fetcher function with authentication
  const fetchEventsWithAuth = async (): Promise<Event[]> => {
    if (!currentUser) return [];
    
    const token = await currentUser.getIdToken();
    const response = await fetch('/api/admin/events', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Fetch all events using the admin endpoint with authentication
  const { data: events = [], isLoading: loadingEvents, error: eventsError } = useQuery<Event[]>({
    queryKey: ['/api/admin/events'],
    queryFn: fetchEventsWithAuth,
    enabled: !!currentUser,
    retry: 1,
  });



  // Custom fetcher function for QR codes with authentication
  const fetchQRCodesWithAuth = async (): Promise<QRCodeType[]> => {
    if (!currentUser) return [];
    
    const token = await currentUser.getIdToken();
    const response = await fetch('/api/admin/qr-codes', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch QR codes: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Fetch QR codes
  const { data: qrCodes = [], isLoading: loadingQRCodes, refetch: refetchQRCodes } = useQuery<QRCodeType[]>({
    queryKey: ['/api/admin/qr-codes'],
    queryFn: fetchQRCodesWithAuth,
    enabled: !!currentUser,
  });

  // Filter events based on search term
  const filteredEvents = events.filter((event: Event) =>
    event.title.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
    event.category.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
    event.location?.toLowerCase().includes(eventSearchTerm.toLowerCase())
  );

  // Create QR code mutation
  const createQRCodeMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentUser) throw new Error('User not authenticated');
      
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/generate-qr', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create QR code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/qr-codes'] });
      setIsCreateDialogOpen(false);
      setSelectedEvent(null);
      setExpirationHours("24");
      setMaxUsage("");
      setEventSearchTerm("");
      setUseCustomDomain(false);
      setCustomDomain("");
      toast({
        title: "QR Code Created",
        description: "QR code generated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create QR code",
        variant: "destructive",
      });
    },
  });

  // Delete QR code mutation
  const deleteQRCodeMutation = useMutation({
    mutationFn: async (qrCodeId: string) => {
      if (!currentUser) throw new Error('User not authenticated');
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/qr-codes/${qrCodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      if (!response.ok) throw new Error('Failed to delete QR code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/qr-codes'] });
      toast({
        title: "QR Code Deleted",
        description: "QR code removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete QR code",
        variant: "destructive",
      });
    },
  });

  // Toggle QR code active status mutation
  const toggleQRCodeMutation = useMutation({
    mutationFn: async ({ qrCodeId, isActive }: { qrCodeId: string; isActive: boolean }) => {
      if (!currentUser) throw new Error('User not authenticated');
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/qr-codes/${qrCodeId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Failed to update QR code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/qr-codes'] });
    },
  });

  const handleCreateQRCode = async () => {
    if (!selectedEvent) return;

    setIsGenerating(true);
    try {
      const baseUrl = useCustomDomain && customDomain ? customDomain.trim() : window.location.origin;
      const qrUrl = `${baseUrl}/qr-access/${selectedEvent.id}`;
      
      await createQRCodeMutation.mutateAsync({
        eventId: selectedEvent.id,
        url: qrUrl,
        expirationHours: parseInt(expirationHours),
        maxUsage: maxUsage ? parseInt(maxUsage) : undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = (qrCode: QRCodeType) => {
    const link = document.createElement('a');
    link.href = qrCode.qrCodeDataUrl;
    link.download = `qr-code-${qrCode.eventTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "QR Code Downloaded",
      description: `QR code saved as ${link.download}`,
    });
  };

  const viewQRCode = (qrCode: QRCodeType) => {
    setSelectedQRCode(qrCode);
    setViewQRDialogOpen(true);
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() < Date.now();
  };

  const getStatusBadge = (qrCode: QRCodeType) => {
    if (!qrCode.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (isExpired(qrCode.expiresAt)) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (qrCode.maxUsage && qrCode.usageCount >= qrCode.maxUsage) {
      return <Badge variant="destructive">Usage Limit Reached</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const formatExpirationTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} left`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} left`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">QR Code Management</h2>
          <p className="text-gray-600">Create and manage QR codes for event access with custom expiration times</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            setSelectedEvent(null);
            setExpirationHours("24");
            setMaxUsage("");
            setEventSearchTerm("");
            setUseCustomDomain(false);
            setCustomDomain("");
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create QR Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Create New QR Code
              </DialogTitle>
              <DialogDescription>
                Generate a QR code for event access with custom settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Event Selection with Integrated Search */}
              <div>
                <Label>Select Event *</Label>
                <Select
                  value={selectedEvent?.id || ""}
                  onValueChange={(value) => {
                    const event = filteredEvents.find((e: Event) => e.id === value);
                    setSelectedEvent(event || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      loadingEvents ? "Loading events..." : 
                      "Choose an event for QR code"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="p-2 border-b sticky top-0 bg-background">
                      <Input
                        placeholder="Search events..."
                        value={eventSearchTerm}
                        onChange={(e) => setEventSearchTerm(e.target.value)}
                        className="h-8"
                      />
                      {events.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {filteredEvents.length} of {events.length} events
                          {eventSearchTerm && ` matching "${eventSearchTerm}"`}
                        </p>
                      )}
                    </div>
                    {loadingEvents ? (
                      <div className="p-4 text-center text-muted-foreground">
                        Loading events...
                      </div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {eventSearchTerm ? 'No events match your search' : 'No events available'}
                      </div>
                    ) : (
                      filteredEvents.map((event: Event) => (
                        <SelectItem key={event.id} value={event.id}>
                          <div className="flex flex-col w-full">
                            <span className="font-medium">{event.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.eventDate).toLocaleDateString()} • {event.location} • {event.category}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Expiration Time */}
              <div>
                <Label>Expiration Time</Label>
                <Select value={expirationHours} onValueChange={setExpirationHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Hour</SelectItem>
                    <SelectItem value="6">6 Hours</SelectItem>
                    <SelectItem value="12">12 Hours</SelectItem>
                    <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                    <SelectItem value="48">48 Hours (2 Days)</SelectItem>
                    <SelectItem value="72">72 Hours (3 Days)</SelectItem>
                    <SelectItem value="168">1 Week</SelectItem>
                    <SelectItem value="720">1 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Usage Limit */}
              <div>
                <Label>Usage Limit (Optional)</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={maxUsage}
                  onChange={(e) => setMaxUsage(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for unlimited usage
                </p>
              </div>

              {/* Custom Domain Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useCustomDomain"
                    checked={useCustomDomain}
                    onCheckedChange={(checked) => setUseCustomDomain(checked as boolean)}
                  />
                  <Label htmlFor="useCustomDomain" className="text-sm font-medium">
                    Use Custom Domain
                  </Label>
                </div>
                {useCustomDomain && (
                  <div>
                    <Label>Custom Domain URL</Label>
                    <Input
                      type="url"
                      placeholder="https://your-ngrok-domain.ngrok.io"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your ngrok or custom domain URL (e.g., https://abc123.ngrok.io)
                    </p>
                  </div>
                )}
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateQRCode}
                disabled={!selectedEvent || isGenerating}
                className="w-full"
              >
                {isGenerating ? 'Generating...' : 'Create QR Code'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* QR Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Active QR Codes
          </CardTitle>
          <CardDescription>
            Manage all your event QR codes and their access settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingQRCodes ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : qrCodes.length === 0 ? (
            <div className="text-center py-8">
              <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No QR codes created yet</p>
              <p className="text-sm text-gray-400">Create your first QR code to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qrCodes.map((qrCode: QRCodeType) => (
                  <TableRow key={qrCode.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{qrCode.eventTitle}</div>
                        <div className="text-sm text-gray-500">ID: {qrCode.eventId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(qrCode)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">{formatExpirationTime(qrCode.expiresAt)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(qrCode.expiresAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">
                          {qrCode.usageCount}
                          {qrCode.maxUsage ? `/${qrCode.maxUsage}` : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">
                          {new Date(qrCode.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewQRCode(qrCode)}
                          title="View QR Code"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadQRCode(qrCode)}
                          title="Download QR Code"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(qrCode.accessUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => 
                            toggleQRCodeMutation.mutate({
                              qrCodeId: qrCode.id,
                              isActive: !qrCode.isActive
                            })
                          }
                        >
                          {qrCode.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteQRCodeMutation.mutate(qrCode.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View QR Code Dialog */}
      <Dialog open={viewQRDialogOpen} onOpenChange={setViewQRDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code: {selectedQRCode?.eventTitle}
            </DialogTitle>
          </DialogHeader>
          
          {selectedQRCode && (
            <div className="space-y-4">
              {/* QR Code Display */}
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img 
                  src={selectedQRCode.qrCodeDataUrl} 
                  alt={`QR Code for ${selectedQRCode.eventTitle}`}
                  className="w-48 h-48 object-contain"
                />
              </div>
              
              {/* QR Code Details */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Event:</span>
                  <span>{selectedQRCode.eventTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  {getStatusBadge(selectedQRCode)}
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Expires:</span>
                  <span>{formatExpirationTime(selectedQRCode.expiresAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Usage:</span>
                  <span>
                    {selectedQRCode.usageCount}
                    {selectedQRCode.maxUsage ? `/${selectedQRCode.maxUsage}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Access URL:</span>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => window.open(selectedQRCode.accessUrl, '_blank')}
                  >
                    Open Link
                  </Button>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => downloadQRCode(selectedQRCode)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedQRCode.accessUrl);
                    toast({
                      title: "URL Copied",
                      description: "QR code URL copied to clipboard"
                    });
                  }}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Copy URL
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRManagement;