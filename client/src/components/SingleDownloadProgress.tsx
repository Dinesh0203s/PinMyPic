import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  X
} from 'lucide-react';

interface SingleDownloadProgress {
  id: string;
  filename: string;
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  speed?: number;
  error?: string;
}

interface SingleDownloadProgressProps {
  downloads: SingleDownloadProgress[];
  onRemove?: (id: string) => void;
}

const SingleDownloadProgress: React.FC<SingleDownloadProgressProps> = ({
  downloads,
  onRemove
}) => {
  if (downloads.length === 0) {
    return null;
  }

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
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {downloads.map((download) => (
        <Card key={download.id} className="shadow-lg border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {getStatusIcon(download.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate" title={download.filename}>
                      {download.filename}
                    </span>
                    {getStatusBadge(download.status)}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Progress value={download.progress} className="h-1 flex-1 mr-2" />
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {download.progress}%
                      </span>
                    </div>
                    
                    {download.status === 'downloading' && download.speed && (
                      <div className="text-xs text-gray-500">
                        {formatSpeed(download.speed)}
                      </div>
                    )}
                    
                    {download.status === 'error' && download.error && (
                      <div className="text-xs text-red-500 truncate" title={download.error}>
                        {download.error}
                      </div>
                    )}
                    
                    {download.status === 'completed' && (
                      <div className="text-xs text-green-600">
                        Download completed
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(download.id)}
                  className="h-6 w-6 p-0 ml-2 flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SingleDownloadProgress;
