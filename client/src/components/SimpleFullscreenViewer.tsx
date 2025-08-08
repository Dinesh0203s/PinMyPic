import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Heart, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Photo } from '@shared/types';
import { useToast } from '@/hooks/use-toast';

interface SimpleFullscreenViewerProps {
  photo: Photo;
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onIndexChange?: (index: number) => void;
  savedPhotoIds?: string[];
  onSavePhoto?: (photoId: string) => Promise<void>;
  onRemovePhoto?: (photoId: string) => Promise<void>;
  savingPhotoIds?: string[];
}

export const SimpleFullscreenViewer: React.FC<SimpleFullscreenViewerProps> = ({
  photo,
  photos,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onIndexChange,
  savedPhotoIds = [],
  onSavePhoto,
  onRemovePhoto,
  savingPhotoIds = []
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isLiked = savedPhotoIds.includes(photo.id);
  const isSaving = savingPhotoIds.includes(photo.id);

  // Reset zoom and position when photo changes
  React.useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [photo.id]);

  const handleDownload = async () => {
    try {
      const downloadUrl = photo.url.startsWith('/api/images/') 
        ? `${photo.url}?download=true` 
        : photo.url;
      
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.filename || 'photo';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading photo:', error);
      const link = document.createElement('a');
      link.href = photo.url;
      link.download = photo.filename || 'photo';
      link.click();
    }
  };

  const handleLike = async () => {
    if (!onSavePhoto || !onRemovePhoto) return;
    
    try {
      if (isLiked) {
        await onRemovePhoto(photo.id);
      } else {
        await onSavePhoto(photo.id);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev * 1.5, 5));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev / 1.5, 1));
    if (scale <= 1.5) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX - position.x, 
        y: e.clientY - position.y 
      });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }, []);

  // Touch handling for pinch-to-zoom
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      setInitialPinchDistance(distance);
      setInitialScale(scale);
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2 && initialPinchDistance) {
      const currentDistance = getTouchDistance(e.touches);
      const scaleRatio = currentDistance / initialPinchDistance;
      const newScale = Math.min(Math.max(initialScale * scaleRatio, 1), 5);
      setScale(newScale);
      
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  }, [initialPinchDistance, initialScale, isDragging, dragStart, scale]);

  const handleTouchEnd = useCallback(() => {
    setInitialPinchDistance(null);
    setIsDragging(false);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          onPrevious?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNext?.();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext, onClose]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        onPrevious?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        onNext?.();
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      case '=':
      case '+':
        event.preventDefault();
        zoomIn();
        break;
      case '-':
        event.preventDefault();
        zoomOut();
        break;
      case '0':
        event.preventDefault();
        resetZoom();
        break;
    }
  }, [onNext, onPrevious, onClose]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Header with close button only */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between text-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 1}
              className="text-white hover:bg-white/20 disabled:opacity-50"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm opacity-75 min-w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 5}
              className="text-white hover:bg-white/20 disabled:opacity-50"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              disabled={scale === 1}
              className="text-white hover:bg-white/20 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 z-20"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 z-20"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Main content area */}
      <div className="flex flex-col items-center justify-center h-full pt-20 pb-8">
        {/* Image container with zoom and pan */}
        <div 
          ref={containerRef}
          className="flex items-center justify-center flex-1 overflow-hidden cursor-grab active:cursor-grabbing px-4"
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && scale === 1) {
              onClose();
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            ref={imageRef}
            src={photo.url.startsWith('/api/images/') 
              ? `${photo.url}?quality=95` 
              : photo.url
            }
            alt={photo.filename}
            className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
            style={{ 
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              maxHeight: 'calc(100vh - 200px)',
              maxWidth: 'calc(100vw - 40px)'
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              console.error('Error loading fullscreen image:', photo.url);
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
            }}
            draggable={false}
          />
        </div>

        {/* Action buttons under the photo */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {/* Like/Save Button */}
          {(onSavePhoto || onRemovePhoto) && (
            <Button
              variant="ghost"
              size="lg"
              onClick={async () => {
                if (isLiked) {
                  await onRemovePhoto?.(photo.id);
                } else {
                  await onSavePhoto?.(photo.id);
                }
              }}
              disabled={isSaving}
              className={`h-12 w-12 rounded-full ${
                isLiked 
                  ? 'bg-pink-500 hover:bg-pink-600 text-white' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              )}
            </Button>
          )}

          {/* Download Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={async () => {
              try {
                const originalUrl = photo.url.includes('/api/images/') 
                  ? `${photo.url}?download=true`
                  : photo.url;
                const response = await fetch(originalUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = photo.filename || 'photo';
                document.body.appendChild(link);
                link.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);
              } catch (error) {
                console.error('Error downloading photo:', error);
              }
            }}
            className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};