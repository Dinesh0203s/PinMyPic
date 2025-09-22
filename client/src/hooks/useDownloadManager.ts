import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';

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

interface UseDownloadManagerOptions {
  maxConcurrent?: number;
  chunkSize?: number;
  retryAttempts?: number;
}

export const useDownloadManager = (options: UseDownloadManagerOptions = {}) => {
  const {
    maxConcurrent = 4,
    chunkSize = 1024 * 1024, // 1MB chunks
    retryAttempts = 3
  } = options;

  const { toast } = useToast();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeDownloadsRef = useRef(0);

  // Add downloads to queue
  const addDownloads = useCallback((items: Array<{ id: string; filename: string; url: string }>) => {
    const newDownloads: DownloadItem[] = items.map(item => ({
      ...item,
      status: 'pending',
      progress: 0,
    }));

    setDownloads(prev => [...prev, ...newDownloads]);
    return newDownloads;
  }, []);

  // Update download progress
  const updateDownload = useCallback((id: string, updates: Partial<DownloadItem>) => {
    setDownloads(prev => prev.map(download => 
      download.id === id ? { ...download, ...updates } : download
    ));
  }, []);

  // Download single file with progress
  const downloadFile = useCallback(async (download: DownloadItem): Promise<Blob | null> => {
    if (isPaused || !abortControllerRef.current) return null;

    try {
      updateDownload(download.id, { status: 'downloading', progress: 0 });

      // First, try to get file size with HEAD request for better progress accuracy
      let totalSize = 0;
      try {
        const headResponse = await fetch(download.url, { 
          method: 'HEAD',
          signal: abortControllerRef.current.signal
        });
        const contentLength = headResponse.headers.get('content-length');
        totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      } catch (headError) {
        console.log('HEAD request failed, proceeding with GET');
      }

      const response = await fetch(download.url, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // If HEAD didn't work, try to get size from GET response
      if (totalSize === 0) {
        const contentLength = response.headers.get('content-length');
        totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      }
      
      updateDownload(download.id, { size: totalSize });
      console.log(`Bulk download: ${download.filename}, Size: ${totalSize > 0 ? (totalSize / 1024 / 1024).toFixed(1) + 'MB' : 'Unknown size'}`);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;
      let lastSpeedUpdate = Date.now();
      let lastDownloadedSize = 0;
      const downloadStartTime = Date.now();

      while (true) {
        if (isPaused) {
          updateDownload(download.id, { status: 'paused' });
          return null;
        }

        const { done, value } = await reader.read();
        
        if (done) break;

        chunks.push(value);
        downloadedSize += value.length;

        // Calculate speed and progress with realistic estimation
        const now = Date.now();
        const timeDiff = now - lastSpeedUpdate;
        
        if (timeDiff >= 250) { // Update every 250ms for smooth progress
          const sizeDiff = downloadedSize - lastDownloadedSize;
          const speed = sizeDiff / (timeDiff / 1000);
          
          // More realistic progress calculation
          let progress: number;
          if (totalSize > 0) {
            // We have content-length, use accurate calculation
            progress = Math.min(98, (downloadedSize / totalSize) * 100);
          } else {
            // No content-length, use conservative chunk-based estimation
            // Ultra-conservative estimation - never go above 80% without knowing file size
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
          
          updateDownload(download.id, {
            downloadedSize,
            speed,
            progress: Math.max(1, Math.round(progress))
          });

          lastSpeedUpdate = now;
          lastDownloadedSize = downloadedSize;
        }

        // Yield control to prevent blocking
        if (downloadedSize % (chunkSize * 4) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Final progress update before completion
      updateDownload(download.id, {
        progress: 99,
        status: 'downloading'
      });

      // Create blob from chunks
      const blob = new Blob(chunks);
      
      // Small delay to show 99% before jumping to 100%
      await new Promise(resolve => setTimeout(resolve, 200));
      
      updateDownload(download.id, {
        status: 'completed',
        progress: 100,
        downloadedSize,
        speed: 0
      });

      return blob;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        updateDownload(download.id, { status: 'paused' });
        return null;
      }

      const errorMessage = error.message || 'Unknown download error';
      updateDownload(download.id, {
        status: 'error',
        error: errorMessage,
        speed: 0
      });

      console.error(`Download failed for ${download.filename}:`, error);
      return null;
    }
  }, [isPaused, updateDownload, chunkSize]);

  // Process download queue
  const processQueue = useCallback(async () => {
    const pendingDownloads = downloads.filter(d => d.status === 'pending');
    const downloadingCount = downloads.filter(d => d.status === 'downloading').length;
    
    if (pendingDownloads.length === 0 || downloadingCount >= maxConcurrent || isPaused) {
      return;
    }

    const toStart = pendingDownloads.slice(0, maxConcurrent - downloadingCount);
    
    const promises = toStart.map(async (download) => {
      activeDownloadsRef.current++;
      const blob = await downloadFile(download);
      activeDownloadsRef.current--;
      return { download, blob };
    });

    await Promise.all(promises);
  }, [downloads, maxConcurrent, isPaused, downloadFile]);

  // Start downloads
  const startDownloads = useCallback(async (zipFilename?: string) => {
    if (downloads.length === 0) return;

    setIsActive(true);
    setIsPaused(false);
    abortControllerRef.current = new AbortController();

    try {
      // Process all downloads
      while (downloads.some(d => d.status === 'pending' || d.status === 'downloading')) {
        if (isPaused) break;
        await processQueue();
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }

      const completedDownloads = downloads.filter(d => d.status === 'completed');
      
      if (completedDownloads.length > 0 && zipFilename) {
        // Create ZIP file
        const zip = new JSZip();
        
        for (const download of completedDownloads) {
          const response = await fetch(download.url);
          const blob = await response.blob();
          zip.file(download.filename, blob);
        }

        const zipBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });

        // Download ZIP
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

    } catch (error) {
      console.error('Download process error:', error);
      toast({
        title: "Download Error",
        description: "An error occurred during the download process.",
        variant: "destructive"
      });
    } finally {
      setIsActive(false);
    }
  }, [downloads, isPaused, processQueue, toast]);

  // Pause downloads
  const pauseDownloads = useCallback(() => {
    setIsPaused(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Resume downloads
  const resumeDownloads = useCallback(() => {
    setIsPaused(false);
    abortControllerRef.current = new AbortController();
    
    // Reset paused downloads to pending
    setDownloads(prev => prev.map(download =>
      download.status === 'paused' ? { ...download, status: 'pending' } : download
    ));
  }, []);

  // Cancel all downloads
  const cancelDownloads = useCallback(() => {
    setIsPaused(false);
    setIsActive(false);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setDownloads([]);
  }, []);

  // Clear completed downloads
  const clearCompleted = useCallback(() => {
    setDownloads(prev => prev.filter(d => d.status !== 'completed'));
  }, []);

  return {
    downloads,
    isActive,
    isPaused,
    addDownloads,
    startDownloads,
    pauseDownloads,
    resumeDownloads,
    cancelDownloads,
    clearCompleted,
    activeDownloads: activeDownloadsRef.current
  };
};
