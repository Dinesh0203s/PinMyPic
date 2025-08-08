import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, HeartOff, Download, Eye, Activity, Zap } from 'lucide-react';
import { useImageOptimization } from '@/hooks/useImageOptimization';
import ImageOptimizer from './ImageOptimizer';

interface SavePhotoOptimizationDemoProps {
  photos: Array<{
    id: string;
    url: string;
    filename: string;
  }>;
  savedPhotoIds?: string[];
  onSavePhoto?: (photoId: string) => Promise<void>;
  onRemovePhoto?: (photoId: string) => Promise<void>;
  currentUser?: any;
}

const SavePhotoOptimizationDemo = ({
  photos,
  savedPhotoIds = [],
  onSavePhoto,
  onRemovePhoto,
  currentUser
}: SavePhotoOptimizationDemoProps) => {
  const [savingPhotoIds, setSavingPhotoIds] = useState<string[]>([]);
  const [operationMetrics, setOperationMetrics] = useState<{
    saveTime: number;
    removeTime: number;
    cacheHits: number;
  }>({
    saveTime: 0,
    removeTime: 0,
    cacheHits: 0
  });

  const {
    state: optimizationState,
    preloadImages,
    isOptimizing
  } = useImageOptimization({
    preloadBatchSize: 8,
    cacheMaxSize: 150,
    connectionAware: true,
    performanceMonitoring: true
  });

  // Preload photos when component mounts
  useEffect(() => {
    if (photos.length > 0) {
      const imageUrls = photos.slice(0, 20).map(photo => photo.url);
      preloadImages(imageUrls, 'medium');
    }
  }, [photos, preloadImages]);

  const handleOptimizedSave = async (photoId: string) => {
    const startTime = Date.now();
    setSavingPhotoIds(prev => [...prev, photoId]);

    try {
      await onSavePhoto?.(photoId);
      
      const saveTime = Date.now() - startTime;
      setOperationMetrics(prev => ({
        ...prev,
        saveTime: Math.round((prev.saveTime + saveTime) / 2) // Running average
      }));
    } catch (error) {
      console.error('Error saving photo:', error);
    } finally {
      setSavingPhotoIds(prev => prev.filter(id => id !== photoId));
    }
  };

  const handleOptimizedRemove = async (photoId: string) => {
    const startTime = Date.now();
    setSavingPhotoIds(prev => [...prev, photoId]);

    try {
      await onRemovePhoto?.(photoId);
      
      const removeTime = Date.now() - startTime;
      setOperationMetrics(prev => ({
        ...prev,
        removeTime: Math.round((prev.removeTime + removeTime) / 2) // Running average
      }));
    } catch (error) {
      console.error('Error removing photo:', error);
    } finally {
      setSavingPhotoIds(prev => prev.filter(id => id !== photoId));
    }
  };

  if (!currentUser || photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Sign in to save photos and see optimization features</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              Save Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">
              {operationMetrics.saveTime}ms
            </div>
            <div className="text-xs text-gray-600">Average save time</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Cache Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-600">
              {optimizationState.cacheSize}
            </div>
            <div className="text-xs text-gray-600">Images cached</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              Saved Photos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-pink-600">
              {savedPhotoIds.length}
            </div>
            <div className="text-xs text-gray-600">Total saved</div>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Image Optimization Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageOptimizer />
        </CardContent>
      </Card>

      {/* Connection and Performance Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {optimizationState.connectionType} connection
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {optimizationState.averageLoadTime.toFixed(0)}ms avg load
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {optimizationState.loadedImages} images loaded
        </Badge>
        {optimizationState.formatSupport.webp && (
          <Badge variant="outline" className="text-green-600">WebP supported</Badge>
        )}
        {isOptimizing && (
          <Badge variant="default" className="animate-pulse">Optimizing...</Badge>
        )}
      </div>

      {/* Sample Photos Grid for Testing */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {photos.slice(0, 12).map((photo) => {
          const isPhotoSaved = savedPhotoIds.includes(photo.id);
          const isPhotoSaving = savingPhotoIds.includes(photo.id);

          return (
            <div
              key={photo.id}
              className="aspect-square relative group overflow-hidden rounded-lg bg-gray-100 border-2 border-transparent hover:border-pink-300 transition-all duration-200"
            >
              <img
                src={photo.url}
                alt={photo.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Optimized Save Button Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="sm"
                  className={`bg-white/90 hover:bg-white ${isPhotoSaved ? 'text-red-500' : 'text-green-500'}`}
                  onClick={isPhotoSaved ? () => handleOptimizedRemove(photo.id) : () => handleOptimizedSave(photo.id)}
                  disabled={isPhotoSaving}
                >
                  {isPhotoSaving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : isPhotoSaved ? (
                    <HeartOff className="h-4 w-4" />
                  ) : (
                    <Heart className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Performance Indicator */}
              {isPhotoSaved && (
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                  <Heart className="h-3 w-3 fill-current" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavePhotoOptimizationDemo;