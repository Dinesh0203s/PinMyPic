import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Share2, ExternalLink, Check, MessageSquare } from 'lucide-react';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Event } from '@shared/types';

interface EventShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
}

export function EventShareDialog({ open, onOpenChange, event }: EventShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const generateShareUrl = async () => {
    if (!event || !currentUser) return;
    
    setLoading(true);
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
        toast({
          title: "Share URL Generated",
          description: "The shareable URL has been created successfully."
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate share URL.",
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
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "URL Copied",
        description: "The share URL has been copied to your clipboard."
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error", 
        description: "Failed to copy URL to clipboard.",
        variant: "destructive"
      });
    }
  };

  const openInBrowser = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  const shareToWhatsApp = () => {
    if (!shareUrl || !event) return;
    
    const message = `🎉 Check out photos from "${event.title}"!\n\n📅 ${new Date(event.eventDate).toLocaleDateString()}\n📍 ${event.location}\n\n✨ View and find your photos here: ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareToInstagram = () => {
    if (!shareUrl || !event) return;
    
    // Instagram doesn't support direct link sharing, so we copy a formatted message
    const message = `🎉 Check out photos from "${event.title}"!\n\n📅 ${new Date(event.eventDate).toLocaleDateString()}\n📍 ${event.location}\n\n✨ Link: ${shareUrl}`;
    
    navigator.clipboard.writeText(message).then(() => {
      toast({
        title: "Instagram Message Copied",
        description: "The message has been copied. You can paste it in Instagram Stories or messages."
      });
    });
  };

  const openInNewTab = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Event: {event?.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-url">Shareable Event URL</Label>
            <div className="text-sm text-gray-600">
              This URL will allow users to access the event directly. For private events, they will be prompted for the event passcode.
            </div>
          </div>
          
          {!shareUrl ? (
            <Button 
              onClick={generateShareUrl} 
              disabled={loading || !event}
              className="w-full"
            >
              {loading ? 'Generating...' : 'Generate Share URL'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  id="share-url"
                  value={shareUrl}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={openInNewTab}
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Social Media Sharing */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Share on Social Media</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={shareToWhatsApp}
                    className="flex-1 gap-2 text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <FaWhatsapp className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={shareToInstagram}
                    className="flex-1 gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <FaInstagram className="h-4 w-4" />
                    Instagram
                  </Button>
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">Event Access Details:</div>
                <div className="text-sm text-blue-700">
                  {event?.isPrivate ? (
                    <>
                      <div><strong>Event Type:</strong> Private</div>
                      <div><strong>Public PIN:</strong> {event.publicPin} (Face recognition required)</div>
                      <div><strong>Bride-Groom PIN:</strong> {event.brideGroomPin} (Full gallery access)</div>
                    </>
                  ) : (
                    <div><strong>Event Type:</strong> Public (No PIN required)</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}