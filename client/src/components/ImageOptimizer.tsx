import { useState, useEffect, useRef } from 'react';
import { imagePreloader } from '@/utils/imagePreloader';

interface ImageOptimizerProps {
  onOptimizeComplete?: (stats: any) => void;
}

const ImageOptimizer = ({ onOptimizeComplete }: ImageOptimizerProps) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize web worker for background optimization
    if ('Worker' in window) {
      const workerBlob = new Blob([`
        self.onmessage = function(e) {
          const { images, options } = e.data;
          
          // Simulate image optimization work
          const processedImages = images.map(img => ({
            ...img,
            optimized: true,
            compressionRatio: 0.8
          }));
          
          self.postMessage({
            type: 'optimization_complete',
            data: processedImages
          });
        };
      `], { type: 'application/javascript' });
      
      workerRef.current = new Worker(URL.createObjectURL(workerBlob));
      
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'optimization_complete') {
          setIsOptimizing(false);
          onOptimizeComplete?.(e.data.data);
        }
      };
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [onOptimizeComplete]);

  const optimizeCache = () => {
    setIsOptimizing(true);
    
    // Clean up old cache entries
    imagePreloader.optimizeCache(50);
    
    // Update stats
    setStats({
      cacheSize: imagePreloader.getCacheSize(),
      lastOptimized: new Date().toISOString()
    });
    
    setTimeout(() => {
      setIsOptimizing(false);
    }, 1000);
  };

  const clearCache = () => {
    imagePreloader.clearCache();
    setStats({
      cacheSize: 0,
      lastCleared: new Date().toISOString()
    });
  };

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-3">Image Performance</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {stats?.cacheSize || imagePreloader.getCacheSize()}
          </div>
          <div className="text-sm text-gray-600">Cached Images</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats?.lastOptimized ? '✓' : '—'}
          </div>
          <div className="text-sm text-gray-600">Cache Status</div>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={optimizeCache}
          disabled={isOptimizing}
          className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {isOptimizing ? 'Optimizing...' : 'Optimize Cache'}
        </button>
        
        <button
          onClick={clearCache}
          className="flex-1 bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600"
        >
          Clear Cache
        </button>
      </div>

      {stats?.lastOptimized && (
        <div className="mt-4 text-xs text-gray-600">
          <div className="font-medium mb-1">Last Optimized:</div>
          <div>{new Date(stats.lastOptimized).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
};

export default ImageOptimizer;