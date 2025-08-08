import { useEffect, useState } from 'react';
import { usePerformanceOptimization, useConnectionAware } from '@/hooks/usePerformanceOptimization';

interface PerformanceStats {
  loadTime: number;
  memoryUsage: number;
  connectionType: string;
  cacheHitRatio: number;
}

export const PerformanceMonitor = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    loadTime: 0,
    memoryUsage: 0,
    connectionType: 'unknown',
    cacheHitRatio: 0,
  });
  const [showStats, setShowStats] = useState(false);
  
  const { cleanupMemory } = usePerformanceOptimization();
  const { getConnectionType } = useConnectionAware();

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;

    const updateStats = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memory = (performance as any).memory;
      
      setStats({
        loadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
        memoryUsage: memory ? memory.usedJSHeapSize / 1024 / 1024 : 0,
        connectionType: getConnectionType(),
        cacheHitRatio: 0, // This would need to be calculated based on actual cache hits
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);

    // Cleanup memory periodically
    const memoryCleanup = setInterval(cleanupMemory, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(memoryCleanup);
    };
  }, [cleanupMemory, getConnectionType]);

  // Keyboard shortcut to toggle performance stats
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setShowStats(!showStats);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showStats]);

  if (process.env.NODE_ENV !== 'development' || !showStats) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-[1000]">
      <div className="mb-2 font-bold">Performance Monitor</div>
      <div>Load Time: {Math.round(stats.loadTime)}ms</div>
      <div>Memory: {stats.memoryUsage.toFixed(1)}MB</div>
      <div>Connection: {stats.connectionType}</div>
      <div className="text-xs text-gray-300 mt-2">Ctrl+Shift+P to toggle</div>
    </div>
  );
};

export default PerformanceMonitor;