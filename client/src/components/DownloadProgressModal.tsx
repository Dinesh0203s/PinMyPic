import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Pause, 
  Play, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileText,
  Archive
} from 'lucide-react';

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
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  isPaused: boolean;
  title?: string;
}

const DownloadProgressModal: React.FC<DownloadProgressModalProps> = ({
  open,
  onOpenChange,
  downloads,
  onCancel,
  onPause,
  onResume,
  isPaused,
  title = "Download Progress"
}) => {
  const completedCount = downloads.filter(d => d.status === 'completed').length;
  const errorCount = downloads.filter(d => d.status === 'error').length;
  const downloadingCount = downloads.filter(d => d.status === 'downloading').length;
  const pendingCount = downloads.filter(d => d.status === 'pending').length;
  const pausedCount = downloads.filter(d => d.status === 'paused').length;

  const totalProgress = downloads.length > 0 
    ? Math.round(downloads.reduce((sum, d) => sum + d.progress, 0) / downloads.length)
    : 0;

  const totalSize = downloads.reduce((sum, d) => sum + (d.size || 0), 0);
  const downloadedSize = downloads.reduce((sum, d) => sum + (d.downloadedSize || 0), 0);
  const totalSpeed = downloads
    .filter(d => d.status === 'downloading' && d.speed)
    .reduce((sum, d) => sum + (d.speed || 0), 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'downloading':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Downloading</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-600">{totalProgress}%</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{completedCount} of {downloads.length} completed</span>
              {totalSpeed > 0 && (
                <span>{formatSpeed(totalSpeed)}</span>
              )}
            </div>
          </div>

          {/* Download Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{downloadingCount}</div>
              <div className="text-xs text-gray-600">Downloading</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-yellow-600">{pausedCount + pendingCount}</div>
              <div className="text-xs text-gray-600">Pending</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-xs text-gray-600">Errors</div>
            </div>
          </div>

          {/* Data Transfer Info */}
          {totalSize > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Downloaded:</span>
                <span>{formatBytes(downloadedSize)} of {formatBytes(totalSize)}</span>
              </div>
              <Progress 
                value={totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0} 
                className="h-1" 
              />
            </div>
          )}

          {/* Download List */}
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium mb-2">Download Queue</div>
            <div className="overflow-y-auto max-h-48 space-y-2 pr-2">
              {downloads.map((download) => (
                <div key={download.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  {getStatusIcon(download.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate" title={download.filename}>
                        {download.filename}
                      </span>
                      {getStatusBadge(download.status)}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <Progress value={download.progress} className="h-1 flex-1 mr-2" />
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {download.progress}%
                      </span>
                    </div>
                    {download.status === 'downloading' && download.speed && (
                      <div className="text-xs text-gray-500 mt-1">
                        {formatSpeed(download.speed)}
                      </div>
                    )}
                    {download.status === 'error' && download.error && (
                      <div className="text-xs text-red-500 mt-1 truncate" title={download.error}>
                        {download.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <div className="flex space-x-2">
              {isPaused ? (
                <Button onClick={onResume} variant="outline" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button onClick={onPause} variant="outline" size="sm">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              <Button onClick={onCancel} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="sm">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadProgressModal;
