import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, ZoomIn, ZoomOut, Move, Crop, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ThumbnailEditorProps {
  imageUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (editedImageDataUrl: string) => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ThumbnailEditor({ imageUrl, open, onOpenChange, onSave }: ThumbnailEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 200, height: 200 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load image when component mounts or imageUrl changes
  useEffect(() => {
    if (imageUrl && open) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImage(img);
        // Initialize crop area to cover the entire container (will be adjusted when container is available)
        setCropArea({
          x: 0,
          y: 0,
          width: 400, // Default container width
          height: 400 // Default container height
        });
      };
      img.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to load image",
          variant: "destructive"
        });
      };
      img.src = imageUrl;
    }
  }, [imageUrl, open, toast]);

  // Handle mouse events for dragging crop area
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return;
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left - cropArea.x,
        y: e.clientY - rect.top - cropArea.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !image) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const newX = e.clientX - rect.left - dragStart.x;
      const newY = e.clientY - rect.top - dragStart.y;
      
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(newX, rect.width - prev.width)),
        y: Math.max(0, Math.min(newY, rect.height - prev.height))
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle zoom changes
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  // Handle rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Reset to original
  const handleReset = () => {
    if (!image || !containerRef.current) return;
    setZoom(1);
    setRotation(0);
    const rect = containerRef.current.getBoundingClientRect();
    setCropArea({
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height
    });
  };

  // Update canvas preview
  const updateCanvasPreview = () => {
    if (!image || !canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate the actual image display dimensions in the container
    const imageAspectRatio = image.width / image.height;
    const containerAspectRatio = containerRect.width / containerRect.height;
    
    let imageDisplayWidth, imageDisplayHeight, imageOffsetX, imageOffsetY;
    
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider than container
      imageDisplayWidth = containerRect.width;
      imageDisplayHeight = containerRect.width / imageAspectRatio;
      imageOffsetX = 0;
      imageOffsetY = (containerRect.height - imageDisplayHeight) / 2;
    } else {
      // Image is taller than container
      imageDisplayHeight = containerRect.height;
      imageDisplayWidth = containerRect.height * imageAspectRatio;
      imageOffsetX = (containerRect.width - imageDisplayWidth) / 2;
      imageOffsetY = 0;
    }

    // Convert crop area from container coordinates to image coordinates
    const cropX = (cropArea.x - imageOffsetX) * (image.width / imageDisplayWidth);
    const cropY = (cropArea.y - imageOffsetY) * (image.height / imageDisplayHeight);
    const cropWidth = cropArea.width * (image.width / imageDisplayWidth);
    const cropHeight = cropArea.height * (image.height / imageDisplayHeight);

    // Set canvas size to crop area
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    
    // Move to center for rotation
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Apply zoom
    ctx.scale(zoom, zoom);
    
    // Draw image centered with proper aspect ratio
    const sourceX = Math.max(0, cropX);
    const sourceY = Math.max(0, cropY);
    const sourceWidth = Math.min(cropWidth, image.width - sourceX);
    const sourceHeight = Math.min(cropHeight, image.height - sourceY);
    
    // Calculate destination dimensions maintaining aspect ratio
    const aspectRatio = sourceWidth / sourceHeight;
    let destWidth = canvas.width / zoom;
    let destHeight = canvas.height / zoom;
    
    if (aspectRatio > destWidth / destHeight) {
      // Source is wider, fit to width
      destHeight = destWidth / aspectRatio;
    } else {
      // Source is taller, fit to height
      destWidth = destHeight * aspectRatio;
    }
    
    ctx.drawImage(
      image,
      sourceX, sourceY, sourceWidth, sourceHeight,
      -destWidth / 2, -destHeight / 2,
      destWidth, destHeight
    );
    
    ctx.restore();
  };

  // Update preview when crop area, zoom, or rotation changes
  useEffect(() => {
    updateCanvasPreview();
  }, [cropArea, zoom, rotation, image]);

  // Initialize crop area to cover the entire container when both image and container are available
  useEffect(() => {
    if (image && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCropArea({
        x: 0,
        y: 0,
        width: rect.width,
        height: rect.height
      });
    }
  }, [image, open]);

  // Save edited image
  const handleSave = async () => {
    if (!image || !canvasRef.current || !containerRef.current) return;
    
    setIsLoading(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Calculate the actual image display dimensions in the container
      const imageAspectRatio = image.width / image.height;
      const containerAspectRatio = containerRect.width / containerRect.height;
      
      let imageDisplayWidth, imageDisplayHeight, imageOffsetX, imageOffsetY;
      
      if (imageAspectRatio > containerAspectRatio) {
        // Image is wider than container
        imageDisplayWidth = containerRect.width;
        imageDisplayHeight = containerRect.width / imageAspectRatio;
        imageOffsetX = 0;
        imageOffsetY = (containerRect.height - imageDisplayHeight) / 2;
      } else {
        // Image is taller than container
        imageDisplayHeight = containerRect.height;
        imageDisplayWidth = containerRect.height * imageAspectRatio;
        imageOffsetX = (containerRect.width - imageDisplayWidth) / 2;
        imageOffsetY = 0;
      }

      // Convert crop area from container coordinates to image coordinates
      const cropX = (cropArea.x - imageOffsetX) * (image.width / imageDisplayWidth);
      const cropY = (cropArea.y - imageOffsetY) * (image.height / imageDisplayHeight);
      const cropWidth = cropArea.width * (image.width / imageDisplayWidth);
      const cropHeight = cropArea.height * (image.height / imageDisplayHeight);

      // Set canvas size to crop area
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply transformations
      ctx.save();
      
      // Move to center for rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Apply zoom
      ctx.scale(zoom, zoom);
      
      // Draw image centered with proper aspect ratio
      const sourceX = Math.max(0, cropX);
      const sourceY = Math.max(0, cropY);
      const sourceWidth = Math.min(cropWidth, image.width - sourceX);
      const sourceHeight = Math.min(cropHeight, image.height - sourceY);
      
      // Calculate destination dimensions maintaining aspect ratio
      const aspectRatio = sourceWidth / sourceHeight;
      let destWidth = canvas.width / zoom;
      let destHeight = canvas.height / zoom;
      
      if (aspectRatio > destWidth / destHeight) {
        // Source is wider, fit to width
        destHeight = destWidth / aspectRatio;
      } else {
        // Source is taller, fit to height
        destWidth = destHeight * aspectRatio;
      }
      
      ctx.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        -destWidth / 2, -destHeight / 2,
        destWidth, destHeight
      );
      
      ctx.restore();

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onSave(dataUrl);
      
      toast({
        title: "Success",
        description: "Thumbnail edited successfully",
      });
    } catch (error) {
      console.error('Error saving edited image:', error);
      toast({
        title: "Error",
        description: "Failed to save edited image",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!image) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Thumbnail</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-4"></div>
              <p>Loading image...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Edit Thumbnail
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <ZoomIn className="h-4 w-4" />
              <span className="text-sm font-medium">Zoom:</span>
              <Slider
                value={[zoom]}
                onValueChange={handleZoomChange}
                min={0.5}
                max={3}
                step={0.1}
                className="w-24"
              />
              <span className="text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Rotate
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Image Editor */}
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <div
              ref={containerRef}
              className="relative cursor-move min-h-[400px] flex items-center justify-center"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {image && (
                <img
                  src={imageUrl}
                  alt="Edit thumbnail"
                  className="max-w-full max-h-full object-contain"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center'
                  }}
                />
              )}
              {/* Crop overlay */}
              {image && (
                <div
                  className="absolute border-2 border-pink-500 bg-pink-500 bg-opacity-20 cursor-move"
                  style={{
                    left: `${cropArea.x}px`,
                    top: `${cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Move className="h-6 w-6 text-pink-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Preview:</span>
            <div className="w-20 h-20 border border-gray-300 rounded overflow-hidden bg-gray-100">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>

        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 border-t bg-white">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
