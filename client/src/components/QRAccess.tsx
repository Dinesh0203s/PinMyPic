import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Camera, 
  QrCode, 
  ArrowRight, 
  Clock,
  Sparkles
} from 'lucide-react';
import { Event } from '@shared/types';

interface QRAccessProps {}

const QRAccess: React.FC<QRAccessProps> = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setError('Invalid QR code - missing event ID');
      setLoading(false);
      return;
    }

    // Check QR code expiration
    const urlParams = new URLSearchParams(window.location.search);
    const expires = urlParams.get('expires');
    
    if (expires) {
      const expirationTime = parseInt(expires);
      const now = Date.now();
      
      if (now > expirationTime) {
        setError('QR code has expired. Please request a new QR code from the event organizer.');
        setLoading(false);
        return;
      }
    }

    // Redirect immediately to events page for selfie
    redirectToEventPage();
  }, [eventId]);

  const redirectToEventPage = async () => {
    try {
      // Get QR code ID from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const qrCodeId = urlParams.get('qrId');
      
      if (qrCodeId) {
        // Validate QR code is active and not deleted
        const qrResponse = await fetch(`/api/qr-codes/${qrCodeId}/validate`);
        
        if (!qrResponse.ok) {
          if (qrResponse.status === 404) {
            throw new Error('QR code not found - this QR code may have been deleted');
          } else if (qrResponse.status === 403) {
            throw new Error('QR code is inactive - this QR code has been deactivated');
          }
          throw new Error('Failed to validate QR code');
        }
      }
      
      // Validate event exists before redirecting
      const response = await fetch(`/api/events/${eventId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found - this QR code may be for an event that no longer exists');
        }
        throw new Error('Failed to validate event');
      }

      // Event exists, redirect immediately to Events page with auto-scan
      navigate(`/events?eventId=${eventId}&skipPin=true&autoScan=true`);
    } catch (err) {
      console.error('Error validating event:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate event');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
              <QrCode className="w-8 h-8" />
            </div>
            <p className="text-gray-600 mt-4">Accessing event and preparing face recognition...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 border-red-200">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-red-800">Invalid QR Code</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-12">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <QrCode className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Welcome to Event Access
          </h1>
          <p className="text-gray-600 text-lg">
            You've successfully scanned the QR code!
          </p>
        </div>

        {/* Event Details Card */}
        <Card className="max-w-2xl mx-auto mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Event Details
              </Badge>
            </div>
            <CardTitle className="text-2xl text-gray-900">{event.title}</CardTitle>
            <CardDescription className="text-lg text-gray-600 mt-2">
              {event.description || 'Photography event'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Event Info Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Event Date</p>
                  <p className="text-gray-600">{new Date(event.eventDate).toLocaleDateString()}</p>
                </div>
              </div>
              
              {event.location && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Location</p>
                    <p className="text-gray-600">{event.location}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Camera className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Photos Available</p>
                  <p className="text-gray-600">{event.photoCount || 0} photos</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Users className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-gray-900">Event Type</p>
                  <p className="text-gray-600 capitalize">{event.category}</p>
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            {event.isPrivate && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <p className="font-medium text-amber-800">Private Event</p>
                </div>
                <p className="text-amber-700 text-sm mt-1">
                  This is a private event. Access is limited to invited guests only.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Find Photos CTA */}
        <Card className="max-w-2xl mx-auto shadow-lg border-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Find Your Photos</h2>
            <p className="text-blue-100 mb-6">
              Use AI-powered face recognition to discover all your photos from this event. 
              Simply take a selfie and we'll find all the photos you appear in!
            </p>
            
            <Button 
              onClick={() => {
                // Navigate to Events page with auto-scan enabled for this event
                window.location.href = `/events?eventId=${event.id}&autoScan=true`;
              }}
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold text-lg px-8 py-3"
            >
              <Camera className="w-5 h-5 mr-2" />
              Take Selfie & Find My Photos
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* How It Works */}
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">How it works</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                1
              </div>
              <p>Take a clear selfie using your device camera</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                2
              </div>
              <p>Our AI analyzes your face and searches the event photos</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                3
              </div>
              <p>View and download all photos where you appear</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRAccess;