import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SingleDownloadProgress {
  id: string;
  filename: string;
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  speed?: number;
  error?: string;
}

export const useSinglePhotoDownload = () => {
  const { toast } = useToast();
  const [activeDownloads, setActiveDownloads] = useState<Map<string, SingleDownloadProgress>>(new Map());

  // Update download progress
  const updateDownload = useCallback((id: string, updates: Partial<SingleDownloadProgress>) => {
    setActiveDownloads(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  // Remove completed download
  const removeDownload = useCallback((id: string) => {
    setActiveDownloads(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  // Download single photo with progress
  const downloadPhoto = useCallback(async (
    photoId: string, 
    photoUrl: string, 
    filename: string,
    showToast: boolean = false // Disable toast by default since we have progress cards
  ) => {
    const downloadId = `${photoId}-${Date.now()}`;
    
    // Initialize download
    setActiveDownloads(prev => new Map(prev).set(downloadId, {
      id: downloadId,
      filename,
      progress: 0,
      status: 'downloading'
    }));

    // No toast notification - progress card handles all feedback

    try {
      // Use the URL as-is since it already has the correct parameters from the component
      const downloadUrl = photoUrl;
      

      // First, try to get file size with HEAD request for better progress accuracy
      let totalSize = 0;
      try {
        const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
        const contentLength = headResponse.headers.get('content-length');
        totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      } catch (headError) {
        console.log('HEAD request failed, proceeding with GET');
      }

      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // If HEAD didn't work, try to get size from GET response
      if (totalSize === 0) {
        const contentLength = response.headers.get('content-length');
        totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      }
      
      console.log(`Download info: ${filename}, Size: ${totalSize > 0 ? (totalSize / 1024 / 1024).toFixed(1) + 'MB' : 'Unknown size'}`);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;
      let lastSpeedUpdate = Date.now();
      let lastDownloadedSize = 0;
      const downloadStartTime = Date.now();

      // Initial progress update - start very low
      updateDownload(downloadId, {
        progress: 0,
        speed: 0,
        status: 'downloading'
      });

      // Read stream with progress tracking
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        chunks.push(value);
        downloadedSize += value.length;

        // Calculate speed and progress
        const now = Date.now();
        const timeDiff = now - lastSpeedUpdate;
        
        if (timeDiff >= 250) { // Update every 250ms for smooth progress
          const sizeDiff = downloadedSize - lastDownloadedSize;
          const speed = sizeDiff / (timeDiff / 1000); // bytes per second
          
          // More realistic progress calculation
          let progress: number;
          if (totalSize > 0) {
            // We have content-length, use accurate calculation
            progress = Math.min(98, (downloadedSize / totalSize) * 100);
          } else {
            // No content-length, use conservative chunk-based estimation
            const elapsedTime = now - downloadStartTime;
            const chunkCount = chunks.length;
            
            // Ultra-conservative estimation - never go above 80% without knowing file size
            const elapsedSeconds = (now - downloadStartTime) / 1000;
            const downloadedMB = downloadedSize / (1024 * 1024);
            
            // Base progress on actual data downloaded, very conservatively
            if (downloadedSize < 50000) { // Less than 50KB
              progress = Math.min(5, (downloadedSize / 50000) * 5);
            } else if (downloadedSize < 200000) { // Less than 200KB  
              progress = 5 + Math.min(15, ((downloadedSize - 50000) / 150000) * 15);
            } else if (downloadedSize < 500000) { // Less than 500KB
              progress = 20 + Math.min(20, ((downloadedSize - 200000) / 300000) * 20);
            } else if (downloadedSize < 1000000) { // Less than 1MB
              progress = 40 + Math.min(20, ((downloadedSize - 500000) / 500000) * 20);
            } else if (downloadedSize < 3000000) { // Less than 3MB
              progress = 60 + Math.min(15, ((downloadedSize - 1000000) / 2000000) * 15);
            } else {
              // Large files - very conservative final stretch
              progress = 75 + Math.min(5, ((downloadedSize - 3000000) / 5000000) * 5);
            }
            
            // Never exceed 80% without knowing actual file size
            progress = Math.min(80, progress);
          }
          
          updateDownload(downloadId, {
            progress: Math.max(1, Math.round(progress)),
            speed: Math.round(speed),
            status: 'downloading'
          });

          lastSpeedUpdate = now;
          lastDownloadedSize = downloadedSize;
        }
      }

      // Final progress update before completion
      updateDownload(downloadId, {
        progress: 99,
        status: 'downloading'
      });

      // Create blob and download
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Small delay to show 99% before jumping to 100%
      await new Promise(resolve => setTimeout(resolve, 200));

      // Mark as completed
      updateDownload(downloadId, {
        progress: 100,
        status: 'completed',
        speed: 0
      });

      // No toast - progress card shows completion status
      console.log(`Download completed: ${filename}`);

      // Remove from active downloads after delay
      setTimeout(() => {
        removeDownload(downloadId);
      }, 3000);

      return true;

    } catch (error: any) {
      console.error('Download error:', error);
      
      updateDownload(downloadId, {
        status: 'error',
        error: error.message || 'Download failed',
        speed: 0
      });

      // No toast - progress card shows error status
      console.error(`Download failed: ${filename}`, error);

      // Remove failed download after delay
      setTimeout(() => {
        removeDownload(downloadId);
      }, 5000);

      return false;
    }
  }, [updateDownload, removeDownload, toast]);

  // Get active downloads as array
  const downloads = Array.from(activeDownloads.values());
  
  return {
    downloadPhoto,
    activeDownloads: downloads,
    isDownloading: downloads.some(d => d.status === 'downloading')
  };
};
