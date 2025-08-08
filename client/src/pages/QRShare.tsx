import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, QrCode, Search, Eye, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Event } from '@shared/types';

const QRShare: React.FC = () => {
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const { toast } = useToast();

  // Fetch all events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['/api/events/all'],
    queryFn: async () => {
      const response = await fetch('/api/events/all');
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  // Filter events based on search term
  const filteredEvents = events.filter((event: Event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateQRCode = async (event: Event) => {
    setIsGenerating(true);
    try {
      // Create the QR URL that will redirect to FindMyFace with event ID
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
      setSelectedEvent(event);
      
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
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !selectedEvent) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qr-code-${selectedEvent.title.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "QR Code Downloaded",
      description: `QR code saved as ${link.download}`,
    });
  };

  const copyQRUrl = async () => {
    if (!selectedEvent) return;

    const baseUrl = window.location.origin;
    const qrUrl = `${baseUrl}/qr-access/${selectedEvent.id}`;
    
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      
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
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                QR Share
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Generate QR codes for events to allow easy access to photo galleries
            </p>
            
            {/* Search Bar */}
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 rounded-full border-2 border-blue-200 focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-8">
              
              {/* Events List */}
              <div>
                <h2 className="text-2xl font-bold mb-6">Select Event</h2>
                
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, index) => (
                      <Card key={index} className="animate-pulse">
                        <CardHeader>
                          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No events found</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {filteredEvents.map((event: Event) => (
                      <Card 
                        key={event.id} 
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedEvent?.id === event.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                        }`}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm text-gray-600">
                            <p><strong>Category:</strong> {event.category}</p>
                            <p><strong>Date:</strong> {new Date(event.eventDate).toLocaleDateString()}</p>
                            {event.location && <p><strong>Location:</strong> {event.location}</p>}
                            <p><strong>Privacy:</strong> {event.isPrivate ? 'Private' : 'Public'}</p>
                            <p><strong>Photos:</strong> {event.photoCount || 0}</p>
                          </div>
                          
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={() => generateQRCode(event)}
                              disabled={isGenerating}
                              className="flex-1"
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              {isGenerating && selectedEvent?.id === event.id ? 'Generating...' : 'Generate QR'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* QR Code Display */}
              <div>
                <h2 className="text-2xl font-bold mb-6">QR Code</h2>
                
                {qrCodeUrl && selectedEvent ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        {selectedEvent.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-6">
                      {/* QR Code Image */}
                      <div className="bg-white p-4 rounded-lg inline-block border">
                        <img 
                          src={qrCodeUrl} 
                          alt={`QR Code for ${selectedEvent.title}`}
                          className="w-64 h-64 mx-auto"
                        />
                      </div>
                      
                      {/* Event Details */}
                      <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Event:</strong> {selectedEvent.title}</p>
                        <p><strong>Date:</strong> {new Date(selectedEvent.eventDate).toLocaleDateString()}</p>
                        <p><strong>Photos:</strong> {selectedEvent.photoCount || 0}</p>
                      </div>
                      
                      {/* QR URL */}
                      <div className="space-y-2">
                        <Label>QR Access URL:</Label>
                        <div className="flex gap-2">
                          <Input
                            value={`${window.location.origin}/qr-access/${selectedEvent.id}`}
                            readOnly
                            className="text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyQRUrl}
                          >
                            {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button onClick={downloadQRCode} className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download QR
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => window.open(`/qr-access/${selectedEvent.id}`, '_blank')}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                      </div>
                      
                      {/* Usage Instructions */}
                      <div className="bg-blue-50 p-4 rounded-lg text-left">
                        <h4 className="font-semibold text-blue-900 mb-2">How to use:</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>1. Share this QR code with event attendees</li>
                          <li>2. Users scan with Google Lens or any QR scanner</li>
                          <li>3. They'll be redirected to the face recognition page</li>
                          <li>4. Users can take a selfie to find their photos</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-2">No QR code generated</p>
                      <p className="text-sm text-gray-400">Select an event and click "Generate QR" to create a QR code</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default QRShare;