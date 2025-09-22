import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, XCircle, AlertCircle, Pause, Play, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  progress: number;
  size?: number;
  downloadedSize?: number;
  speed?: number;
  error?: string;
}

interface DownloadProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloads: DownloadItem[];
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isPaused?: boolean;
  title?: string;
}

export const DownloadProgressModal: React.FC<DownloadProgressModalProps> = ({
  open,
  onOpenChange,
  downloads,
  onCancel,
  onPause,
  onResume,
  isPaused = false,
  title = "Download Progress"
}) => {
  const { toast } = useToast();
  const [startTime] = useState(Date.now());

  // Calculate overall progress
  const totalProgress = downloads.length > 0 
    ? downloads.reduce((sum, item) => sum + item.progress, 0) / downloads.length 
    : 0;

  const completedCount = downloads.filter(item => item.status === 'completed').length;
  const errorCount = downloads.filter(item => item.status === 'error').length;
  const downloadingCount = downloads.filter(item => item.status === 'downloading').length;

  // Calculate total download speed
  const totalSpeed = downloads
    .filter(item => item.status === 'downloading' && item.speed)
    .reduce((sum, item) => sum + (item.speed || 0), 0);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format speed
  const formatSpeed = (bytesPerSecond: number) => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  // Estimate time remaining
  const getTimeRemaining = () => {
    if (totalSpeed === 0 || totalProgress >= 100) return 'Calculating...';
    
    const remainingItems = downloads.filter(item => item.status !== 'completed' && item.status !== 'error');
    const estimatedSeconds = remainingItems.length * 2; // Rough estimate
    
    if (estimatedSeconds < 60) return `${estimatedSeconds}s remaining`;
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = estimatedSeconds % 60;
    return `${minutes}m ${seconds}s remaining`;
  };

  // Get status icon
  const getStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-500 animate-bounce" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Auto-close when all downloads complete
  useEffect(() => {
    if (downloads.length > 0 && completedCount === downloads.length && errorCount === 0) {
      setTimeout(() => {
        toast({
          title: "Downloads Complete",
          description: `Successfully downloaded ${completedCount} files`,
        });
        onOpenChange(false);
      }, 2000);
    }
  }, [completedCount, downloads.length, errorCount, toast, onOpenChange]);

  const handleClose = () => {
    if (downloadingCount > 0) {
      // Show confirmation for active downloads
      if (window.confirm('Downloads are in progress. Are you sure you want to cancel?')) {
        onCancel?.();
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                Overall Progress ({completedCount}/{downloads.length})
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(totalProgress)}%
              </span>
            </div>
            <Progress value={totalProgress} className="h-3" />
            
            {/* Stats Row */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {downloadingCount > 0 && (
                  <>Speed: {formatSpeed(totalSpeed)} • </>
                )}
                {errorCount > 0 && (
                  <span className="text-red-500">{errorCount} errors • </span>
                )}
                {getTimeRemaining()}
              </span>
              <span>
                Elapsed: {Math.floor((Date.now() - startTime) / 1000)}s
              </span>
            </div>
          </div>

          {/* Individual Downloads */}
          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2 sm:p-3">
            {downloads.map((download) => (
              <div key={download.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(download.status)}
                    <span className="text-xs sm:text-sm truncate flex-1" title={download.filename}>
                      {download.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground flex-shrink-0">
                    {download.status === 'downloading' && download.speed && (
                      <span className="hidden sm:inline">📡 {formatSpeed(download.speed)}</span>
                    )}
                    <span className="font-medium">{Math.round(download.progress)}%</span>
                    {download.status === 'downloading' && (
                      <span className="text-gray-600 hidden sm:inline">
                        {download.progress < 1 ? 'Starting...' : 
                         download.progress < 5 ? 'Connecting...' : 
                         download.progress < 99 ? 'Downloading...' : 
                         'Finalizing...'}
                      </span>
                    )}
                  </div>
                </div>
                
                {download.status !== 'pending' && (
                  <Progress 
                    value={download.progress} 
                    className="h-1 sm:h-1.5"
                  />
                )}
                
                {download.error && (
                  <p className="text-xs text-red-500 truncate" title={download.error}>
                    Error: {download.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex gap-2">
              {downloadingCount > 0 && (
                <>
                  {isPaused ? (
                    <Button variant="outline" size="sm" onClick={onResume} className="flex-1 sm:flex-none">
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onPause} className="flex-1 sm:flex-none">
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              {downloadingCount > 0 && (
                <Button variant="destructive" size="sm" onClick={onCancel} className="flex-1 sm:flex-none">
                  <X className="h-4 w-4 mr-1" />
                  Cancel All
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleClose} className="flex-1 sm:flex-none">
                {downloadingCount > 0 ? 'Hide' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadProgressModal;
