
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, getAvailableTabs } from '@/utils/adminUtils';
import { 
  Users, 
  Calendar, 
  Camera, 
  BookOpen, 
  TrendingUp, 
  DollarSign,
  Search,
  Plus,
  Edit,
  Trash2,
  Info,
  FileText,
  Eye,
  EyeOff,
  Phone,
  Mail,
  MapPin,
  Clock,
  User,
  Lock,
  RefreshCw,
  QrCode,
  Download,
  Copy,
  Check,
  Database,
  HardDrive,
  BarChart3
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, Filter } from 'lucide-react';
import Header from '@/components/Header';
import { CreateEventDialog } from '@/components/CreateEventDialog';
import { CreatePackageDialog } from '@/components/CreatePackageDialog';
import { PhotoUploadDialog } from '@/components/PhotoUploadDialog';
import { CreateBookingDialog } from '@/components/CreateBookingDialog';
import { ManageUsersDialog } from '@/components/ManageUsersDialog';
import { EditableEventRow } from '@/components/EditableEventRow';
import { EventDetailsDialog } from '@/components/EventDetailsDialog';
import { AnalyticsReport } from '@/components/AnalyticsReport';

import { AdminUsersManagement } from '@/components/AdminUsersManagement';
import AdminRoleManagement from '@/components/AdminRoleManagement';
import QRManagement from '@/components/QRManagement';


import { Booking, ContactMessage, Event, Package } from '@shared/types';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmation, ConfirmationAlert } from '@/components/ui/confirmation-alert';

interface AdminStats {
  totalEvents: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  unreadMessages: number;
}

interface StorageStats {
  database: {
    totalEvents: number;
    totalBookings: number;
    totalMessages: number;
    totalPackages: number;
    totalUsers: number;
    totalPhotos: number;
  };
  storage: {
    totalPhotoSize: number;
    totalPhotoSizeMB: number;
    totalPhotoSizeGB: number;
    averagePhotosPerEvent: number;
    photosByEvent: Record<string, number>;
  };
  breakdown: {
    activeEvents: number;
    emptyEvents: number;
    pendingBookings: number;
    confirmedBookings: number;
    activePackages: number;
    inactivePackages: number;
    adminUsers: number;
    regularUsers: number;
    unreadMessages: number;
    readMessages: number;
  };
}

const AdminDashboard = () => {
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof Booking>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [uploadGalleryOpen, setUploadGalleryOpen] = useState(false);
  const [selectedEventForUpload, setSelectedEventForUpload] = useState<Event | null>(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [selectedEventForView, setSelectedEventForView] = useState<Event | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  
  // Package management states
  const [packageSearchTerm, setPackageSearchTerm] = useState('');
  const [packageStatusFilter, setPackageStatusFilter] = useState<string>('all');
  const [packageSortField, setPackageSortField] = useState<keyof Package>('createdAt');
  const [packageSortDirection, setPackageSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // QR Management states
  const [selectedEventForQR, setSelectedEventForQR] = useState<Event | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [copiedQRUrl, setCopiedQRUrl] = useState(false);
  
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get available tabs based on user permissions
  const availableTabs = getAvailableTabs(userData);
  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].value : 'events');

  // Helper function to get authentication headers
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!currentUser) return {};
    try {
      const token = await currentUser.getIdToken();
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Error getting auth token:', error);
      return {};
    }
  };

  // Separate function to fetch packages for reuse
  const fetchPackages = async () => {
    try {
      const headers = await getAuthHeaders();
      const packagesRes = await fetch('/api/packages', { headers });
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData || []);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  // Package filtering and sorting logic
  const filteredAndSortedPackages = packages
    .filter(pkg => {
      // Status filter
      if (packageStatusFilter === 'active' && !pkg.isActive) return false;
      if (packageStatusFilter === 'inactive' && pkg.isActive) return false;
      
      // Search filter
      if (packageSearchTerm) {
        const searchLower = packageSearchTerm.toLowerCase();
        return (
          pkg.name?.toLowerCase().includes(searchLower) ||
          pkg.duration?.toLowerCase().includes(searchLower) ||
          pkg.photoCount?.toLowerCase().includes(searchLower) ||
          pkg.features?.some(feature => feature.toLowerCase().includes(searchLower)) ||
          pkg.price?.toString().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (packageSortField) {
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt || '').getTime();
          bValue = new Date(b.createdAt || '').getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt || '').getTime();
          bValue = new Date(b.updatedAt || '').getTime();
          break;
        default:
          aValue = a[packageSortField];
          bValue = b[packageSortField];
      }
      
      if (packageSortDirection === 'asc') {
        return (aValue ?? 0) < (bValue ?? 0) ? -1 : (aValue ?? 0) > (bValue ?? 0) ? 1 : 0;
      } else {
        return (aValue ?? 0) > (bValue ?? 0) ? -1 : (aValue ?? 0) < (bValue ?? 0) ? 1 : 0;
      }
    });

  const handlePackageSort = (field: keyof Package) => {
    if (packageSortField === field) {
      setPackageSortDirection(packageSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPackageSortField(field);
      setPackageSortDirection('asc');
    }
  };



  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        console.log('Admin Dashboard: Starting parallel data fetch...');

        // Get authentication headers
        const headers = await getAuthHeaders();

        // Fetch all data in parallel for better performance
        const promises = [
          fetch('/api/bookings', { headers }).then(res => res.ok ? res.json() : []).catch(() => []),
          fetch('/api/admin/stats', { headers }).then(res => res.ok ? res.json() : null).catch(() => null),
          fetch('/api/admin/storage', { headers }).then(res => res.ok ? res.json() : null).catch(() => null),
          fetch('/api/contact', { headers }).then(res => res.ok ? res.json() : []).catch(() => []),
          fetch('/api/admin/events', { headers }).then(res => res.ok ? res.json() : []).catch(() => []),
          fetch('/api/packages', { headers }).then(res => res.ok ? res.json() : []).catch(() => [])
        ];

        const [bookingsData, statsData, storageData, messagesData, eventsData, packagesData] = await Promise.all(promises);

        // Update all states at once
        setBookings(bookingsData || []);
        setStats(statsData);
        setStorageStats(storageData);
        setMessages(messagesData || []);
        setEvents(eventsData || []);
        setPackages(packagesData || []);
        
        console.log('Admin Dashboard: Data fetch completed');
      } catch (error) {
        console.error('Admin Dashboard: General error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [currentUser]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'processed': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleBookingAction = async (bookingId: string, status: 'confirmed' | 'cancelled' | 'pending') => {
    try {
      console.log(`Updating booking ${bookingId} to status: ${status}`);
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        console.log('Booking status updated successfully');
        // Refresh bookings data
        const bookingsRes = await fetch('/api/bookings');
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData);
          console.log('Bookings data refreshed');
        }
      } else {
        console.error('Failed to update booking status:', response.statusText);
        toast({
          title: "Error",
          description: "Failed to update booking status. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: "Failed to update booking status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAmountChange = async (bookingId: string, amount: number) => {
    try {
      console.log(`Updating booking ${bookingId} amount to: ${amount}`);
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });

      if (response.ok) {
        const updatedBooking = await response.json();
        console.log('Amount updated successfully:', updatedBooking);
        
        // Update local state immediately
        setBookings(prevBookings => 
          prevBookings.map(booking => 
            booking.id === bookingId ? { ...booking, amount } : booking
          )
        );
        
        // Update the selected booking if it's currently viewed
        if (selectedBooking && selectedBooking.id === bookingId) {
          setSelectedBooking(prev => prev ? { ...prev, amount } : null);
        }
      } else {
        console.error('Failed to update booking amount:', response.statusText);
        toast({
          title: "Error",
          description: "Failed to update amount. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating booking amount:', error);
      toast({
        title: "Error",
        description: "Failed to update amount. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      console.log(`Deleting booking: ${bookingId}`);
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('Booking deleted successfully');
        // Refresh bookings data
        const bookingsRes = await fetch('/api/bookings');
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData);
          console.log('Bookings data refreshed after deletion');
        }
        toast({
          title: "Success",
          description: "Booking deleted successfully.",
        });
      } else {
        console.error('Failed to delete booking:', response.statusText);
        toast({
          title: "Error",
          description: "Failed to delete booking. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: "Error",
        description: "Failed to delete booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/contact/${messageId}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        // Refresh messages data
        const messagesRes = await fetch('/api/contact');
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          setMessages(messagesData || []);
        }
        toast({
          title: "Success",
          description: "Message deleted successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete message. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClearAllMessages = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/contact/clear-all', {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        setMessages([]);
        toast({
          title: "Success",
          description: "All messages cleared successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to clear messages. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast({
        title: "Error",
        description: "Failed to clear messages. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setViewDialogOpen(true);
  };

  const handleSort = (field: keyof Booking) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedAndFilteredBookings = () => {
    let filteredBookings = bookings.filter(booking => {
      // Search filter
      const matchesSearch = booking.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.eventType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.location?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort bookings
    filteredBookings.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle date sorting
      if (sortField === 'eventDate' || sortField === 'createdAt') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredBookings;
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      console.log('Refreshing admin dashboard data...');

      const [statsRes, storageRes, bookingsRes, messagesRes, eventsRes] = await Promise.all([
        fetch('/api/admin/stats').catch(() => ({ ok: false })),
        fetch('/api/admin/storage').catch(() => ({ ok: false })),
        fetch('/api/bookings').catch(() => ({ ok: false })),
        fetch('/api/contact').catch(() => ({ ok: false })),
        fetch('/api/admin/events').catch(() => ({ ok: false }))
      ]);

      if (statsRes.ok && 'json' in statsRes) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (storageRes.ok && 'json' in storageRes) {
        const storageData = await storageRes.json();
        setStorageStats(storageData);
      }

      if (bookingsRes.ok && 'json' in bookingsRes) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData || []);
      }

      if (messagesRes.ok && 'json' in messagesRes) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData || []);
      }

      if (eventsRes.ok && 'json' in eventsRes) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData || []);
      }

      // Refresh packages data
      await fetchPackages();

      // Trigger users data refresh by incrementing the refresh trigger
      setRefreshTrigger(prev => prev + 1);

      console.log('Admin dashboard data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing admin data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewEvent = (event: Event) => {
    setSelectedEventForView(event);
    setIsEditingEvent(false);
    setEventDetailsOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEventForView(event);
    setEventDetailsOpen(true);
    setIsEditingEvent(true);
    // The EventDetailsDialog will handle the editing functionality
  };

  const handleUploadPhotos = (eventId: string) => {
    // Photo upload is now handled by the PhotoUploadDialog component
    console.log('Photo upload triggered for event:', eventId);
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const token = await currentUser?.getIdToken();
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        refreshData();
        toast({
          title: "Success",
          description: "Event deleted successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete event. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleHideEvent = async (eventId: string, currentHiddenStatus: boolean) => {
    try {
      const token = await currentUser?.getIdToken();
      const response = await fetch(`/api/events/${eventId}/toggle-hidden`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isHidden: !currentHiddenStatus })
      });

      if (response.ok) {
        refreshData();
        toast({
          title: "Success",
          description: `Event ${!currentHiddenStatus ? 'hidden' : 'shown'} successfully.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update event visibility. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling event visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update event visibility. Please try again.",
        variant: "destructive",
      });
    }
  };

  // QR Code generation functions
  const generateQRCode = async (event: Event) => {
    setIsGeneratingQR(true);
    try {
      const baseUrl = window.location.origin;
      const qrUrl = `${baseUrl}/qr-access/${event.id}`;
      
      const response = await fetch('/api/admin/generate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          url: qrUrl
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const data = await response.json();
      setQrCodeUrl(data.qrCodeDataUrl);
      setSelectedEventForQR(event);
      
      toast({
        title: "QR Code Generated",
        description: `QR code created for ${event.title}`,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !selectedEventForQR) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qr-code-${selectedEventForQR.title.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "QR Code Downloaded",
      description: `QR code saved as ${link.download}`,
    });
  };

  const copyQRUrl = async () => {
    if (!selectedEventForQR) return;

    const baseUrl = window.location.origin;
    const qrUrl = `${baseUrl}/qr-access/${selectedEventForQR.id}`;
    
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopiedQRUrl(true);
      setTimeout(() => setCopiedQRUrl(false), 2000);
      
      toast({
        title: "URL Copied",
        description: "QR access URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full overflow-hidden">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 truncate">Admin Dashboard</h1>
              {userData && (
                <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 px-2 sm:px-3 py-1 text-xs sm:text-sm w-fit">
                  {userData.adminRole === 'owner' && '👑 Owner'}
                  {userData.adminRole === 'admin' && '🛡️ Administrator'}
                  {userData.adminRole === 'moderator' && '⚡ Moderator'}
                </Badge>
              )}
            </div>
            <p className="text-sm sm:text-base text-gray-600">Welcome back! Here's what's happening with your photography business.</p>
          </div>
          <Button 
            onClick={refreshData}
            disabled={refreshing || loading}
            variant="outline"
            size="sm"
            className="bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl font-bold">Quick Actions</CardTitle>
            <CardDescription className="text-sm">Administrative tasks based on your permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {hasPermission(userData, 'bookings') && (
                <CreateBookingDialog onBookingCreated={() => {
                  console.log('Booking created, refreshing data...');
                  const refreshData = async () => {
                    try {
                      const bookingsRes = await fetch('/api/bookings');
                      if (bookingsRes.ok) {
                        const bookingsData = await bookingsRes.json();
                        setBookings(bookingsData);
                      }
                    } catch (error) {
                      console.error('Error refreshing bookings:', error);
                    }
                  };
                  refreshData();
                }} />
              )}
              {hasPermission(userData, 'events') && (
                <CreateEventDialog onEventCreated={() => {
                  console.log('Event created, refreshing data...');
                  const refreshData = async () => {
                    try {
                      const eventsRes = await fetch('/api/admin/events');
                      if (eventsRes.ok) {
                        const eventsData = await eventsRes.json();
                        setEvents(eventsData);
                      }
                    } catch (error) {
                      console.error('Error refreshing events:', error);
                    }
                  };
                  refreshData();
                }} />
              )}

              {hasPermission(userData, 'users') && (
                <ManageUsersDialog onUserUpdated={() => {
                  console.log('User updated, refreshing data...');
                }} />
              )}
              {hasPermission(userData, 'events') && (
                <Button 
                  variant="outline" 
                  className="bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100"
                  onClick={() => setAnalyticsOpen(true)}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Analytics Report
                </Button>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEvents}</div>
                <p className="text-xs text-muted-foreground">Active events</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                <BookOpen className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBookings}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingBookings} pending, {stats.confirmedBookings} confirmed
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From confirmed bookings</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unreadMessages}</div>
                <p className="text-xs text-muted-foreground">Unread messages</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="border-b border-gray-200 mb-4 sm:mb-6 -mx-2 sm:mx-0">
            <div className="overflow-x-auto scrollbar-hide px-2 sm:px-0">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-none bg-transparent p-0 space-x-0 min-w-max">
                {availableTabs.map((tab) => (
                  <TabsTrigger 
                    key={tab.value} 
                    value={tab.value}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent transition-colors duration-200"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>



          {hasPermission(userData, 'events') && (
            <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Event Management</CardTitle>
                    <CardDescription className="text-sm">Create and manage photography events with photo galleries</CardDescription>
                  </div>
                  <CreateEventDialog onEventCreated={refreshData} />
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto border rounded-lg">
                  <Table className="min-w-full text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Event Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead>Photos</TableHead>
                        <TableHead>PINs</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length > 0 ? (
                        events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.title}</TableCell>
                            <TableCell>{new Date(event.eventDate).toLocaleDateString()}</TableCell>
                            <TableCell>{event.location}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{event.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge className={event.isPrivate ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                                  {event.isPrivate ? 'Private' : 'Public'}
                                </Badge>
                                {event.isHidden && (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                    Hidden
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{event.photoCount || 0} photos</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {event.publicPin && (
                                  <div className="text-xs">
                                    <span className="font-mono bg-gray-100 px-1 rounded">Public: {event.publicPin}</span>
                                  </div>
                                )}
                                {event.brideGroomPin && (
                                  <div className="text-xs">
                                    <span className="font-mono bg-pink-100 px-1 rounded">B&G: {event.brideGroomPin}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleViewEvent(event)} title="View Details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <PhotoUploadDialog 
                                  eventId={event.id} 
                                  eventTitle={event.title}
                                  onPhotosUploaded={refreshData}
                                />
                                <Button variant="ghost" size="sm" onClick={() => handleEditEvent(event)} title="Edit Event">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleToggleHideEvent(event.id, event.isHidden)}
                                  title={event.isHidden ? "Show Event" : "Hide Event"}
                                  className={event.isHidden ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"}
                                >
                                  {event.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </Button>
                                <DeleteConfirmation
                                  itemName={event.title}
                                  itemType="event"
                                  onConfirm={() => handleDeleteEvent(event.id)}
                                  trigger={
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      title="Delete Event"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No events created yet</p>
                            <p className="text-sm mt-2">Create your first event to start managing photo galleries</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {events.length > 0 ? (
                    events.map((event) => (
                      <Card key={event.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex flex-col space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-base font-semibold text-gray-900 mb-1">{event.title}</h3>
                                <div className="flex items-center text-sm text-gray-600 mb-2">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {new Date(event.eventDate).toLocaleDateString()}
                                </div>
                                <div className="flex items-center text-sm text-gray-600 mb-2">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  {event.location}
                                </div>
                              </div>
                              <Badge variant="outline" className="ml-2">{event.category}</Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={event.isPrivate ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                                {event.isPrivate ? 'Private' : 'Public'}
                              </Badge>
                              {event.isHidden && (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                  Hidden
                                </Badge>
                              )}
                              <Badge variant="secondary">
                                <Camera className="h-3 w-3 mr-1" />
                                {event.photoCount || 0} photos
                              </Badge>
                            </div>
                            
                            {(event.publicPin || event.brideGroomPin) && (
                              <div className="space-y-2 pt-2 border-t">
                                <div className="text-sm font-medium text-gray-700">Access PINs:</div>
                                <div className="space-y-2">
                                  {event.publicPin && (
                                    <div className="flex items-center">
                                      <span className="text-sm text-gray-600 w-16">Public:</span>
                                      <span className="font-mono bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm font-medium">{event.publicPin}</span>
                                    </div>
                                  )}
                                  {event.brideGroomPin && (
                                    <div className="flex items-center">
                                      <span className="text-sm text-gray-600 w-16">B&G:</span>
                                      <span className="font-mono bg-pink-100 text-pink-800 px-3 py-1 rounded-md text-sm font-medium">{event.brideGroomPin}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-5 gap-1 pt-3 border-t">
                              <Button variant="ghost" size="sm" onClick={() => handleViewEvent(event)} title="View Details" className="p-2">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <PhotoUploadDialog 
                                eventId={event.id} 
                                eventTitle={event.title}
                                onPhotosUploaded={refreshData}
                              />
                              <Button variant="ghost" size="sm" onClick={() => handleEditEvent(event)} title="Edit Event" className="p-2">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleToggleHideEvent(event.id, event.isHidden)}
                                title={event.isHidden ? "Show Event" : "Hide Event"}
                                className={`p-2 ${event.isHidden ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"}`}
                              >
                                {event.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              </Button>
                              <ConfirmationAlert
                                title="Delete Event"
                                description={
                                  <div className="space-y-3">
                                    <p className="text-red-200">⚠️ This action is permanent and cannot be undone!</p>
                                    <div className="bg-gray-800 p-3 rounded border-l-4 border-red-500">
                                      <h4 className="font-semibold text-gray-100 mb-2">Event Details:</h4>
                                      <div className="space-y-1 text-sm text-gray-300">
                                        <div><span className="text-gray-400">Title:</span> {event.title}</div>
                                        <div><span className="text-gray-400">Date:</span> {new Date(event.eventDate).toLocaleDateString()}</div>
                                        <div><span className="text-gray-400">Location:</span> {event.location}</div>
                                        <div><span className="text-gray-400">Photos:</span> {event.photoCount || 0} photos</div>
                                        <div><span className="text-gray-400">Status:</span> {event.isPrivate ? 'Private' : 'Public'}</div>
                                        <div><span className="text-gray-400">Created:</span> {event.createdAt ? new Date(event.createdAt).toLocaleDateString() : 'N/A'}</div>
                                      </div>
                                    </div>
                                    <p className="text-red-200 text-sm">
                                      • All photos will be permanently deleted<br/>
                                      • Users will lose access to saved photos<br/>
                                      • QR codes will become invalid
                                    </p>
                                  </div>
                                }
                                confirmText="Delete Event"
                                cancelText="Cancel"
                                variant="destructive"
                                onConfirm={() => handleDeleteEvent(event.id)}
                                trigger={
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    title="Delete Event"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No events created yet</p>
                      <p className="text-sm mt-2">Create your first event to start managing photo galleries</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {hasPermission(userData, 'bookings') && (
            <TabsContent value="bookings" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">All Bookings</CardTitle>
                    <CardDescription className="text-sm">Manage all event bookings and requests</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search bookings..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-full sm:w-64"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <CreateBookingDialog onBookingCreated={() => {
                        console.log('Booking created from bookings tab, refreshing data...');
                        const refreshData = async () => {
                          try {
                            const bookingsRes = await fetch('/api/bookings');
                            if (bookingsRes.ok) {
                              const bookingsData = await bookingsRes.json();
                              setBookings(bookingsData);
                            }
                          } catch (error) {
                            console.error('Error refreshing bookings:', error);
                          }
                        };
                        refreshData();
                      }} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Results Summary */}
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">
                    Showing {getSortedAndFilteredBookings().length} of {bookings.length} bookings
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getSortedAndFilteredBookings().length > 0 ? (
                    getSortedAndFilteredBookings().map((booking) => (
                      <Card key={booking.id} className="relative hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                                {booking.name || 'Unknown Client'}
                              </CardTitle>
                              <div className="flex items-center text-sm text-gray-600 mb-2">
                                <Calendar className="h-4 w-4 mr-1" />
                                {booking.eventType}
                              </div>
                              <div className="flex items-center text-sm text-gray-600 mb-2">
                                <Clock className="h-4 w-4 mr-1" />
                                {new Date(booking.eventDate).toLocaleDateString()}
                              </div>
                              {booking.location && (
                                <div className="flex items-center text-sm text-gray-600 mb-2">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  {booking.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {/* Status */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Status</Label>
                              <Select 
                                value={booking.status} 
                                onValueChange={(newStatus) => handleBookingAction(booking.id, newStatus as 'confirmed' | 'cancelled' | 'pending')}
                              >
                                <SelectTrigger className={`w-full ${getStatusColor(booking.status)} border-0`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                      Pending
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="confirmed">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      Confirmed
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="cancelled">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                      Cancelled
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Amount */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Amount</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold">₹</span>
                                <input
                                  type="number"
                                  value={booking.amount || 0}
                                  onChange={(e) => handleAmountChange(booking.id, Number(e.target.value))}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  min="0"
                                  step="50"
                                />
                              </div>
                            </div>

                            {/* Contact Info */}
                            {booking.email && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Mail className="h-4 w-4 mr-2" />
                                <a href={`mailto:${booking.email}`} className="text-blue-600 hover:underline truncate">
                                  {booking.email}
                                </a>
                              </div>
                            )}
                            {booking.phone && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Phone className="h-4 w-4 mr-2" />
                                <a href={`tel:${booking.phone}`} className="text-blue-600 hover:underline">
                                  {booking.phone}
                                </a>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2 border-t">
                              <Button variant="outline" size="sm" onClick={() => handleViewBooking(booking)} className="flex-1">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <ConfirmationAlert
                                title="Delete Booking"
                                description={
                                  <div className="space-y-3">
                                    <p className="text-red-200">⚠️ This action is permanent and cannot be undone!</p>
                                    <div className="bg-gray-800 p-3 rounded border-l-4 border-red-500">
                                      <h4 className="font-semibold text-gray-100 mb-2">Booking Details:</h4>
                                      <div className="space-y-1 text-sm text-gray-300">
                                        <div><span className="text-gray-400">Client:</span> {booking.name || 'Unknown'}</div>
                                        <div><span className="text-gray-400">Event Type:</span> {booking.eventType}</div>
                                        <div><span className="text-gray-400">Date:</span> {new Date(booking.eventDate).toLocaleDateString()}</div>
                                        {booking.location && <div><span className="text-gray-400">Location:</span> {booking.location}</div>}
                                        <div><span className="text-gray-400">Status:</span> <span className={
                                          booking.status === 'confirmed' ? 'text-green-400' :
                                          booking.status === 'cancelled' ? 'text-red-400' : 'text-yellow-400'
                                        }>{booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span></div>
                                        <div><span className="text-gray-400">Amount:</span> ₹{booking.amount || 0}</div>
                                        {booking.email && <div><span className="text-gray-400">Email:</span> {booking.email}</div>}
                                        {booking.phone && <div><span className="text-gray-400">Phone:</span> {booking.phone}</div>}
                                        <div><span className="text-gray-400">Booked:</span> {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'}</div>
                                      </div>
                                    </div>
                                    <p className="text-red-200 text-sm">
                                      • All booking information will be lost<br/>
                                      • Client contact history will be removed<br/>
                                      • Payment records will be deleted
                                    </p>
                                  </div>
                                }
                                confirmText="Delete Booking"
                                cancelText="Cancel"
                                variant="destructive"
                                onConfirm={() => handleDeleteBooking(booking.id)}
                                trigger={
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-gray-500 mb-4">
                        {bookings.length === 0 
                          ? 'No bookings found' 
                          : 'No bookings match your filters'
                        }
                      </p>
                      <p className="text-sm text-gray-400 mb-4">
                        {bookings.length === 0 
                          ? 'Create your first booking to get started' 
                          : 'Try adjusting your search or filter options'
                        }
                      </p>
                      {bookings.length === 0 && (
                        <CreateBookingDialog onBookingCreated={() => {
                          const refreshData = async () => {
                            try {
                              const bookingsRes = await fetch('/api/bookings');
                              if (bookingsRes.ok) {
                                const bookingsData = await bookingsRes.json();
                                setBookings(bookingsData);
                              }
                            } catch (error) {
                              console.error('Error refreshing bookings:', error);
                            }
                          };
                          refreshData();
                        }} />
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {hasPermission(userData, 'packages') && (
            <TabsContent value="packages" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Photography Packages</CardTitle>
                    <CardDescription>Manage your photography service packages and pricing</CardDescription>
                  </div>
                  <CreatePackageDialog onPackageCreated={fetchPackages} />
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search packages by name, duration, features, or price..."
                      value={packageSearchTerm}
                      onChange={(e) => setPackageSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={packageStatusFilter} onValueChange={setPackageStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Packages</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={`${packageSortField}-${packageSortDirection}`} onValueChange={(value) => {
                    const [field, direction] = value.split('-') as [keyof Package, 'asc' | 'desc'];
                    setPackageSortField(field);
                    setPackageSortDirection(direction);
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt-desc">Newest First</SelectItem>
                      <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                      <SelectItem value="name-asc">Name A-Z</SelectItem>
                      <SelectItem value="name-desc">Name Z-A</SelectItem>
                      <SelectItem value="price-asc">Price Low-High</SelectItem>
                      <SelectItem value="price-desc">Price High-Low</SelectItem>
                      <SelectItem value="updatedAt-desc">Recently Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Results Summary */}
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">
                    Showing {filteredAndSortedPackages.length} of {packages.length} packages
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedPackages.length > 0 ? (
                    filteredAndSortedPackages.map((pkg) => (
                      <Card key={pkg.id} className="relative">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{pkg.name}</CardTitle>
                              <div className="flex gap-2 mt-2">
                                {pkg.isPopular && (
                                  <Badge className="bg-orange-100 text-orange-800">Popular</Badge>
                                )}
                                <Badge className={pkg.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                  {pkg.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">₹{pkg.price}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              <Clock className="w-4 h-4 inline mr-1" />
                              {pkg.duration}
                            </p>
                            <p className="text-sm text-gray-600">
                              <Camera className="w-4 h-4 inline mr-1" />
                              {pkg.photoCount}
                            </p>
                            <div className="mt-3">
                              <p className="text-sm font-medium mb-2">Features:</p>
                              <ul className="text-sm text-gray-600 space-y-1">
                                {pkg.features?.map((feature, index) => (
                                  <li key={`${pkg.id}-feature-${index}-${feature.substring(0, 10)}`} className="flex items-center">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <CreatePackageDialog 
                              editPackage={pkg} 
                              isEditing={true} 
                              onPackageCreated={fetchPackages} 
                            />
                            <DeleteConfirmation
                              itemName={pkg.name}
                              itemType="package"
                              onConfirm={async () => {
                                try {
                                  await fetch(`/api/packages/${pkg.id}`, { method: 'DELETE' });
                                  await fetchPackages();
                                  toast({
                                    title: "Success",
                                    description: `Package "${pkg.name}" deleted successfully.`,
                                  });
                                } catch (error) {
                                  console.error('Error deleting package:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to delete package. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              trigger={
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              }
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-gray-500 mb-4">
                        {packages.length === 0 
                          ? 'No packages found' 
                          : 'No packages match your filters'
                        }
                      </p>
                      <p className="text-sm text-gray-400 mb-4">
                        {packages.length === 0 
                          ? 'Create your first package to get started' 
                          : 'Try adjusting your search or filter options'
                        }
                      </p>
                      {packages.length === 0 && (
                        <CreatePackageDialog onPackageCreated={fetchPackages} />
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}



          {hasPermission(userData, 'contacts') && (
            <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                  <div>
                    <CardTitle>Contact Messages</CardTitle>
                    <CardDescription>Manage messages from contact form submissions</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Badge variant="secondary" className="px-3 py-1 w-fit">
                      {messages.filter(m => !m.isRead).length} unread
                    </Badge>
                    {messages.length > 0 && (
                      <DeleteConfirmation
                        itemName="all contact messages"
                        itemType="messages"
                        onConfirm={handleClearAllMessages}
                        trigger={
                          <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear All
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Results Summary */}
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">
                    Showing {messages.length} message{messages.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {messages.length > 0 ? (
                    messages.map((message) => (
                      <Card key={message.id} className={`relative hover:shadow-lg transition-shadow ${!message.isRead ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg font-semibold text-gray-900 mb-1 truncate">
                                {message.name}
                              </CardTitle>
                              <div className="flex items-center text-sm text-gray-600 mb-2">
                                <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                                {new Date(message.createdAt).toLocaleDateString()}
                              </div>
                              <div className="flex items-center text-sm text-gray-600 mb-2">
                                <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                                <a 
                                  href={`mailto:${message.email}`} 
                                  className="text-blue-600 hover:underline truncate"
                                  title={message.email}
                                >
                                  {message.email}
                                </a>
                              </div>
                            </div>
                            <Badge 
                              variant={message.isRead ? "secondary" : "default"} 
                              className="whitespace-nowrap ml-2"
                            >
                              {message.isRead ? 'Read' : 'Unread'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {/* Subject */}
                            <div>
                              <Label className="text-sm font-medium mb-1 block">Subject</Label>
                              <p className="text-sm text-gray-700 line-clamp-2" title={message.subject || 'No subject'}>
                                {message.subject || 'No subject'}
                              </p>
                            </div>

                            {/* Message */}
                            <div>
                              <Label className="text-sm font-medium mb-1 block">Message</Label>
                              <p className="text-sm text-gray-700 line-clamp-3" title={message.message}>
                                {message.message}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedMessage(message);
                                  setMessageDialogOpen(true);
                                  // Mark as read
                                  fetch(`/api/contact/${message.id}/read`, { method: 'PATCH' })
                                    .then(() => refreshData())
                                    .catch(console.error);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => window.location.href = `mailto:${message.email}?subject=Re: ${message.subject || 'Your inquiry'}`}
                                title="Reply via email"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <DeleteConfirmation
                                itemName={`message from ${message.name}`}
                                itemType="message"
                                onConfirm={() => handleDeleteMessage(message.id)}
                                trigger={
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-gray-500 mb-4">No messages received yet</p>
                      <p className="text-sm text-gray-400">Contact form submissions will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {hasPermission(userData, 'users') && (
            <TabsContent value="users" className="space-y-6">
              <AdminRoleManagement currentUser={userData} refreshTrigger={refreshTrigger} />
            </TabsContent>
          )}

          {hasPermission(userData, 'qr_codes') && (
            <TabsContent value="qr" className="space-y-6">
              <QRManagement />
            </TabsContent>
          )}

          {hasPermission(userData, 'storage') && (
            <TabsContent value="storage" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Storage Overview
                      </CardTitle>
                      <CardDescription>Monitor database and file storage usage</CardDescription>
                    </div>
                    <Button variant="outline" onClick={refreshData} disabled={refreshing}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {storageStats ? (
                <div className="space-y-6">
                  {/* Database Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-700">
                        <Database className="h-5 w-5" />
                        Database Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                          <div className="text-2xl font-bold text-blue-700">{storageStats.database.totalEvents}</div>
                          <div className="text-sm text-blue-600">Events</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                          <BookOpen className="h-8 w-8 mx-auto mb-2 text-green-600" />
                          <div className="text-2xl font-bold text-green-700">{storageStats.database.totalBookings}</div>
                          <div className="text-sm text-green-600">Bookings</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                          <Mail className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                          <div className="text-2xl font-bold text-purple-700">{storageStats.database.totalMessages}</div>
                          <div className="text-sm text-purple-600">Messages</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg text-center">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                          <div className="text-2xl font-bold text-orange-700">{storageStats.database.totalPackages}</div>
                          <div className="text-sm text-orange-600">Packages</div>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg text-center">
                          <Users className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                          <div className="text-2xl font-bold text-indigo-700">{storageStats.database.totalUsers}</div>
                          <div className="text-sm text-indigo-600">Users</div>
                        </div>
                        <div className="bg-pink-50 p-4 rounded-lg text-center">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-pink-600" />
                          <div className="text-2xl font-bold text-pink-700">{storageStats.database.totalPhotos}</div>
                          <div className="text-sm text-pink-600">Photos</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Storage Usage */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <HardDrive className="h-5 w-5" />
                        Storage Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700">Total Storage</span>
                            <HardDrive className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="text-3xl font-bold text-green-800">{storageStats.storage.totalPhotoSizeGB} GB</div>
                          <div className="text-sm text-green-600 mt-1">{storageStats.storage.totalPhotoSizeMB} MB</div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">Avg per Event</span>
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="text-3xl font-bold text-blue-800">{storageStats.storage.averagePhotosPerEvent}</div>
                          <div className="text-sm text-blue-600 mt-1">photos/event</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-purple-700">Est. Size per Photo</span>
                            <Camera className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="text-3xl font-bold text-purple-800">~2 MB</div>
                          <div className="text-sm text-purple-600 mt-1">average size</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Breakdown Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-indigo-700">
                        <BarChart3 className="h-5 w-5" />
                        Detailed Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Active Events</div>
                          <div className="text-2xl font-bold text-green-600">{storageStats.breakdown.activeEvents}</div>
                          <div className="text-sm text-gray-500">with photos</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Empty Events</div>
                          <div className="text-2xl font-bold text-yellow-600">{storageStats.breakdown.emptyEvents}</div>
                          <div className="text-sm text-gray-500">no photos</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Pending Bookings</div>
                          <div className="text-2xl font-bold text-orange-600">{storageStats.breakdown.pendingBookings}</div>
                          <div className="text-sm text-gray-500">awaiting response</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Confirmed Bookings</div>
                          <div className="text-2xl font-bold text-green-600">{storageStats.breakdown.confirmedBookings}</div>
                          <div className="text-sm text-gray-500">accepted</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Active Packages</div>
                          <div className="text-2xl font-bold text-blue-600">{storageStats.breakdown.activePackages}</div>
                          <div className="text-sm text-gray-500">available</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Inactive Packages</div>
                          <div className="text-2xl font-bold text-gray-600">{storageStats.breakdown.inactivePackages}</div>
                          <div className="text-sm text-gray-500">disabled</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Admin Users</div>
                          <div className="text-2xl font-bold text-purple-600">{storageStats.breakdown.adminUsers}</div>
                          <div className="text-sm text-gray-500">with admin access</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Regular Users</div>
                          <div className="text-2xl font-bold text-gray-600">{storageStats.breakdown.regularUsers}</div>
                          <div className="text-sm text-gray-500">standard users</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Unread Messages</div>
                          <div className="text-2xl font-bold text-red-600">{storageStats.breakdown.unreadMessages}</div>
                          <div className="text-sm text-gray-500">need attention</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-lg font-semibold text-gray-700">Read Messages</div>
                          <div className="text-2xl font-bold text-green-600">{storageStats.breakdown.readMessages}</div>
                          <div className="text-sm text-gray-500">processed</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Loading storage statistics...</p>
                      <p className="text-sm text-gray-500 mt-2">Please wait while we gather data</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

        </Tabs>
      </div>

      {/* Booking Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Booking Details</DialogTitle>
            <DialogDescription>
              Complete information about this booking request
            </DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-6 p-2">
              {/* Header with Status */}
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="text-xl font-semibold">{selectedBooking.name}</h3>
                  <p className="text-gray-600">{selectedBooking.email}</p>
                </div>
                <Badge className={getStatusColor(selectedBooking.status)} variant="outline">
                  {selectedBooking.status.toUpperCase()}
                </Badge>
              </div>

              {/* Client Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                      <User className="h-5 w-5" />
                      Client Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Name:</span>
                      </div>
                      <span className="font-semibold">{selectedBooking.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Email:</span>
                      </div>
                      <span>{selectedBooking.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Phone:</span>
                      </div>
                      <span>{selectedBooking.phone || 'Not provided'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                      <Calendar className="h-5 w-5" />
                      Event Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-600">Event Type:</span>
                      <span className="font-semibold">{selectedBooking.eventType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Date:</span>
                      </div>
                      <span>{new Date(selectedBooking.eventDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Time:</span>
                      </div>
                      <span>{selectedBooking.eventTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Location:</span>
                      </div>
                      <span>{selectedBooking.location}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Booking Details */}
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-purple-700">Booking Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block">Duration:</span>
                      <p className="text-lg font-semibold text-gray-800">{selectedBooking.duration}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block">Guest Count:</span>
                      <p className="text-lg font-semibold text-gray-800">{selectedBooking.guestCount || 'Not specified'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block">Package:</span>
                      <p className="text-lg font-semibold text-gray-800">{selectedBooking.packageType || 'Not specified'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block">Amount:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-800">₹</span>
                        <input
                          type="number"
                          value={selectedBooking.amount || 0}
                          onChange={(e) => {
                            const newAmount = Number(e.target.value);
                            setSelectedBooking(prev => prev ? {...prev, amount: newAmount} : null);
                            handleAmountChange(selectedBooking.id, newAmount);
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-lg font-semibold"
                          min="0"
                          step="50"
                        />
                      </div>
                    </div>
                  </div>

                  {selectedBooking.message && (
                    <div className="mt-4">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Client Message:</span>
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                        <p className="text-gray-800 italic">"{selectedBooking.message}"</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t bg-gray-50 p-4 rounded-lg">
                {selectedBooking.status === 'pending' ? (
                  <>
                    <Button 
                      onClick={() => {
                        handleBookingAction(selectedBooking.id, 'confirmed');
                        setViewDialogOpen(false);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1 py-3 text-lg font-semibold"
                      size="lg"
                    >
                      ✓ Accept Booking
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        handleBookingAction(selectedBooking.id, 'cancelled');
                        setViewDialogOpen(false);
                      }}
                      className="flex-1 py-3 text-lg font-semibold"
                      size="lg"
                    >
                      ✗ Decline Booking
                    </Button>
                  </>
                ) : (
                  <div className="flex-1 text-center">
                    <p className="text-gray-600 text-lg">
                      This booking has been {selectedBooking.status === 'confirmed' ? 'accepted' : 'declined'}.
                    </p>
                    {selectedBooking.status === 'confirmed' && (
                      <p className="text-green-600 font-semibold mt-2">
                        Amount: ₹{selectedBooking.amount || 0}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Comprehensive Event Details Dialog - Disabled in favor of EventDetailsDialog */}
      <Dialog open={false} onOpenChange={() => setSelectedEventForView(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              Complete Event Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedEventForView && (
            <div className="space-y-6 py-4">
              {/* Basic Event Information */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                    <Info className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Event Title:</span>
                      <p className="text-lg font-semibold text-gray-800 break-words">{selectedEventForView.title}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Event ID:</span>
                      <p className="text-sm font-mono text-gray-700 break-all">{selectedEventForView.id}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Category:</span>
                      <Badge variant="outline" className="text-base">{selectedEventForView.category}</Badge>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Visibility:</span>
                      <Badge className={selectedEventForView.isPrivate ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                        {selectedEventForView.isPrivate ? 'Private Event' : 'Public Event'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Date & Location */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                    <MapPin className="h-5 w-5" />
                    Date & Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Event Date:</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-800">
                        {new Date(selectedEventForView.eventDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-600">Location:</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-800 break-words">{selectedEventForView.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {selectedEventForView.description && (
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
                      <FileText className="h-5 w-5" />
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                        {selectedEventForView.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Access & Security */}
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                    <Lock className="h-5 w-5" />
                    Access & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Public PIN:</span>
                      {selectedEventForView.publicPin ? (
                        <p className="text-lg font-mono bg-green-100 text-green-800 px-3 py-2 rounded border">
                          {selectedEventForView.publicPin}
                        </p>
                      ) : (
                        <p className="text-gray-500 italic">Not set</p>
                      )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Bride & Groom PIN:</span>
                      {selectedEventForView.brideGroomPin ? (
                        <p className="text-lg font-mono bg-pink-100 text-pink-800 px-3 py-2 rounded border">
                          {selectedEventForView.brideGroomPin}
                        </p>
                      ) : (
                        <p className="text-gray-500 italic">Not set</p>
                      )}
                    </div>
                  </div>
                  {selectedEventForView.passcode && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Additional Passcode:</span>
                      <p className="text-lg font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border break-all">
                        {selectedEventForView.passcode}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Photo & Media Information */}
              <Card className="border-l-4 border-l-indigo-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                    <Camera className="h-5 w-5" />
                    Photo & Media
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Photo Count:</span>
                      <p className="text-3xl font-bold text-indigo-600">{selectedEventForView.photoCount || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Thumbnail URL:</span>
                      {selectedEventForView.thumbnailUrl ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 break-all font-mono">{selectedEventForView.thumbnailUrl}</p>
                          <img 
                            src={selectedEventForView.thumbnailUrl} 
                            alt="Event thumbnail" 
                            className="w-full h-20 object-cover rounded border"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No thumbnail set</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Creation & Modification Info */}
              <Card className="border-l-4 border-l-gray-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
                    <Clock className="h-5 w-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Created At:</span>
                      <p className="text-sm text-gray-800">
                        {new Date(selectedEventForView.createdAt).toLocaleString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Last Updated:</span>
                      <p className="text-sm text-gray-800">
                        {new Date(selectedEventForView.updatedAt).toLocaleString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  {selectedEventForView.createdBy && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="font-medium text-sm text-gray-600 block mb-2">Created By:</span>
                      <p className="text-sm font-mono text-gray-700 break-all">{selectedEventForView.createdBy}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedEventForView(null)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => handleEditEvent(selectedEventForView)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Event
                </Button>
                <Button variant="outline" onClick={() => handleUploadPhotos(selectedEventForView.id)}>
                  <Camera className="h-4 w-4 mr-2" />
                  Upload Photos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <EventDetailsDialog
        event={selectedEventForView}
        open={eventDetailsOpen}
        onOpenChange={(open) => {
          setEventDetailsOpen(open);
          if (!open) {
            setIsEditingEvent(false);
          }
        }}
        onEventUpdated={refreshData}
        initialEditMode={isEditingEvent}
      />

      {/* Analytics Report */}
      <AnalyticsReport
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
      />

      {/* Message Details Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl font-bold">Message Details</DialogTitle>
          </DialogHeader>
          
          {selectedMessage && (
            <div className="space-y-4 pb-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <User className="h-4 w-4 sm:h-5 sm:w-5" />
                    Sender Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                    <span className="font-medium text-sm text-gray-600">Name:</span>
                    <span className="font-semibold text-sm sm:text-base break-words">{selectedMessage.name}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                    <span className="font-medium text-sm text-gray-600">Email:</span>
                    <a 
                      href={`mailto:${selectedMessage.email}`} 
                      className="text-blue-600 hover:underline text-sm sm:text-base break-words"
                    >
                      {selectedMessage.email}
                    </a>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                    <span className="font-medium text-sm text-gray-600">Date:</span>
                    <span className="text-sm sm:text-base">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg">Message Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedMessage.subject && (
                    <div>
                      <span className="font-medium text-sm text-gray-600 block mb-2">Subject:</span>
                      <p className="font-semibold text-sm sm:text-base break-words bg-gray-50 p-3 rounded-lg">{selectedMessage.subject}</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-sm text-gray-600 block mb-2">Message:</span>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
                      <p className="text-gray-800 whitespace-pre-wrap text-sm sm:text-base leading-relaxed break-words">{selectedMessage.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setMessageDialogOpen(false)}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => window.location.href = `mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject || 'Your inquiry'}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-2"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Reply via Email</span>
                  <span className="sm:hidden">Reply</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
