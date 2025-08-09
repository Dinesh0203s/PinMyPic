import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Activity, Zap, Database } from 'lucide-react';
import { apiCache, imageCache, userCache } from '@/utils/cache';
import { requestOptimizer } from '@/utils/requestOptimization';

interface PerformanceMetrics {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  navigation?: PerformanceNavigationTiming;
  paint?: PerformanceEntry[];
  cacheStats: {
    api: { size: number; memoryUsage: string; totalHits: number; };
    image: { size: number; memoryUsage: string; totalHits: number; };
    user: { size: number; memoryUsage: string; totalHits: number; };
  };
  requestStats: {
    activeRequests: number;
    queuedRequests: number;
    inFlightRequests: number;
    maxConcurrent: number;
  };
  connectionType?: string;
}

// Development-only performance monitor
const PerformanceMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // Toggle with Ctrl+Shift+P
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      const performanceData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintData = performance.getEntriesByType('paint');
      const memoryData = (performance as any).memory;
      
      const connectionData = (navigator as any).connection;
      const connectionType = connectionData?.effectiveType || 'unknown';

      setMetrics({
        memory: memoryData,
        navigation: performanceData,
        paint: paintData,
        cacheStats: {
          api: apiCache.getStats(),
          image: imageCache.getStats(),
          user: userCache.getStats()
        },
        requestStats: requestOptimizer.getStats(),
        connectionType
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (process.env.NODE_ENV !== 'development' || !isVisible || !metrics) {
    return null;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (time: number) => {
    return `${time.toFixed(2)}ms`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 max-h-96 overflow-y-auto">
      <Card className="bg-black/90 text-white border-gray-600">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <CardTitle className="text-sm">Performance Monitor</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0 hover:bg-white/20"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          {/* Connection Info */}
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <Zap className="h-3 w-3" />
              <span className="font-medium">Connection</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {metrics.connectionType?.toUpperCase()}
            </Badge>
          </div>

          {/* Memory Usage */}
          {metrics.memory && (
            <div>
              <div className="flex items-center space-x-1 mb-1">
                <Database className="h-3 w-3" />
                <span className="font-medium">Memory</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Used: {formatBytes(metrics.memory.usedJSHeapSize)}</div>
                <div>Total: {formatBytes(metrics.memory.totalJSHeapSize)}</div>
                <div>Limit: {formatBytes(metrics.memory.jsHeapSizeLimit)}</div>
              </div>
            </div>
          )}

          {/* Page Load Performance */}
          {metrics.navigation && (
            <div>
              <div className="font-medium mb-1">Page Load</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>DOM: {formatTime(metrics.navigation.domContentLoadedEventEnd - metrics.navigation.fetchStart)}</div>
                <div>Load: {formatTime(metrics.navigation.loadEventEnd - metrics.navigation.fetchStart)}</div>
                <div>TTFB: {formatTime(metrics.navigation.responseStart - metrics.navigation.fetchStart)}</div>
                <div>FCP: {metrics.paint?.find(p => p.name === 'first-contentful-paint') ? 
                  formatTime(metrics.paint.find(p => p.name === 'first-contentful-paint')!.startTime) : 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Cache Statistics */}
          <div>
            <div className="font-medium mb-1">Cache Stats</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>API:</span>
                <span>{metrics.cacheStats.api.size} items ({metrics.cacheStats.api.memoryUsage})</span>
              </div>
              <div className="flex justify-between">
                <span>Images:</span>
                <span>{metrics.cacheStats.image.size} items ({metrics.cacheStats.image.memoryUsage})</span>
              </div>
              <div className="flex justify-between">
                <span>User:</span>
                <span>{metrics.cacheStats.user.size} items ({metrics.cacheStats.user.memoryUsage})</span>
              </div>
            </div>
          </div>

          {/* Request Statistics */}
          <div>
            <div className="font-medium mb-1">Requests</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Active: {metrics.requestStats.activeRequests}</div>
              <div>Queued: {metrics.requestStats.queuedRequests}</div>
              <div>In-flight: {metrics.requestStats.inFlightRequests}</div>
              <div>Max: {metrics.requestStats.maxConcurrent}</div>
            </div>
          </div>

          <div className="text-xs text-gray-400 pt-2 border-t border-gray-600">
            Press Ctrl+Shift+P to toggle
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceMonitor;