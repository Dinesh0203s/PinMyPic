import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SingleDownload {
  id: string;
  filename: string;
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  speed?: number;
  error?: string;
}

interface SingleDownloadProgressProps {
  downloads: SingleDownload[];
  className?: string;
}

export const SingleDownloadProgress: React.FC<SingleDownloadProgressProps> = ({ 
  downloads, 
  className = "" 
}) => {
  if (downloads.length === 0) return null;

  // Format file size
  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get status icon
  const getStatusIcon = (status: SingleDownload['status']) => {
    switch (status) {
      case 'downloading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Download className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 z-50 space-y-3 ${className}`}>
      {downloads.map((download) => (
        <Card 
          key={download.id} 
          className="w-full sm:w-96 shadow-2xl border-l-4 border-l-blue-500 bg-white/98 backdrop-blur-md animate-in slide-in-from-right-5 duration-300"
        >
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-2 sm:space-y-3">
              {/* Header with icon, filename, and percentage */}
              <div className="flex items-center gap-2 sm:gap-3">
                {getStatusIcon(download.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-xs sm:text-sm font-semibold truncate text-gray-800" title={download.filename}>
                      📄 {download.filename}
                    </p>
                    <span className="text-sm sm:text-lg font-bold text-blue-600 ml-2">
                      {Math.round(download.progress)}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Progress bar for downloading status */}
              {download.status === 'downloading' && (
                <>
                  <div className="space-y-1 sm:space-y-2">
                    <Progress value={download.progress} className="h-2 sm:h-3 bg-gray-200" />
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600 font-medium truncate flex-1 mr-2">
                        📡 {download.speed ? formatSpeed(download.speed) : 'Initializing...'}
                      </span>
                      <span className="text-gray-600 font-medium text-right whitespace-nowrap">
                        {download.progress < 1 ? 'Starting...' : 
                         download.progress < 5 ? 'Connecting...' : 
                         download.progress < 99 ? 'Downloading...' : 
                         'Finalizing...'}
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              {/* Completed status */}
              {download.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-700 font-semibold text-xs sm:text-sm bg-green-50 p-2 rounded-md">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="truncate">✅ Download complete - Saved to Downloads folder</span>
                </div>
              )}
              
              {/* Error status */}
              {download.status === 'error' && download.error && (
                <div className="flex items-center gap-2 text-red-700 text-xs sm:text-sm bg-red-50 p-2 rounded-md">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <div className="flex-1 truncate" title={download.error}>
                    ❌ {download.error.length > 35 ? download.error.substring(0, 35) + '...' : download.error}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SingleDownloadProgress;
