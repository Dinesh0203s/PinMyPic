import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, ZoomIn, ZoomOut, Move, Crop, Save, X, Maximize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NewThumbnailEditorProps {
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

export function NewThumbnailEditor({ imageUrl, open, onOpenChange, onSave }: NewThumbnailEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 400, height: 400 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  // Load image when component mounts or imageUrl changes
  useEffect(() => {
    if (imageUrl && open) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImage(img);
        // Initialize crop area to center of image
        const containerWidth = 500; // Default container width
        const containerHeight = 400; // Default container height
        const cropSize = Math.min(300, Math.min(containerWidth, containerHeight) * 0.8);
        
        setCropArea({
          x: (containerWidth - cropSize) / 2,
          y: (containerHeight - cropSize) / 2,
          width: cropSize,
          height: cropSize
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

  // Update crop area when container is available
  useEffect(() => {
    if (image && containerRef.current && open) {
      const rect = containerRef.current.getBoundingClientRect();
      const cropSize = Math.min(300, Math.min(rect.width, rect.height) * 0.8);
      
      setCropArea({
        x: (rect.width - cropSize) / 2,
        y: (rect.height - cropSize) / 2,
        width: cropSize,
        height: cropSize
      });
    }
  }, [image, open]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!image || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on resize handles
    const handleSize = 8;
    const { x: cropX, y: cropY, width, height } = cropArea;
    
    // Check each corner and edge
    if (x >= cropX - handleSize && x <= cropX + handleSize && 
        y >= cropY - handleSize && y <= cropY + handleSize) {
      setResizeHandle('nw');
    } else if (x >= cropX + width - handleSize && x <= cropX + width + handleSize && 
               y >= cropY - handleSize && y <= cropY + handleSize) {
      setResizeHandle('ne');
    } else if (x >= cropX - handleSize && x <= cropX + handleSize && 
               y >= cropY + height - handleSize && y <= cropY + height + handleSize) {
      setResizeHandle('sw');
    } else if (x >= cropX + width - handleSize && x <= cropX + width + handleSize && 
               y >= cropY + height - handleSize && y <= cropY + height + handleSize) {
      setResizeHandle('se');
    } else if (x >= cropX && x <= cropX + width && y >= cropY && y <= cropY + height) {
      // Inside crop area - drag
      setIsDragging(true);
      setDragStart({ x: x - cropX, y: y - cropY });
    }
    
    setIsResizing(resizeHandle !== null);
  }, [image, cropArea, resizeHandle]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!image || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDragging) {
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(x - dragStart.x, rect.width - prev.width)),
        y: Math.max(0, Math.min(y - dragStart.y, rect.height - prev.height))
      }));
    } else if (isResizing && resizeHandle) {
      setCropArea(prev => {
        let newCrop = { ...prev };
        
        switch (resizeHandle) {
          case 'nw':
            newCrop.x = Math.max(0, x);
            newCrop.y = Math.max(0, y);
            newCrop.width = Math.max(50, prev.x + prev.width - x);
            newCrop.height = Math.max(50, prev.y + prev.height - y);
            break;
          case 'ne':
            newCrop.y = Math.max(0, y);
            newCrop.width = Math.max(50, x - prev.x);
            newCrop.height = Math.max(50, prev.y + prev.height - y);
            break;
          case 'sw':
            newCrop.x = Math.max(0, x);
            newCrop.width = Math.max(50, prev.x + prev.width - x);
            newCrop.height = Math.max(50, y - prev.y);
            break;
          case 'se':
            newCrop.width = Math.max(50, x - prev.x);
            newCrop.height = Math.max(50, y - prev.y);
            break;
        }
        
        // Keep within container bounds
        newCrop.x = Math.max(0, Math.min(newCrop.x, rect.width - newCrop.width));
        newCrop.y = Math.max(0, Math.min(newCrop.y, rect.height - newCrop.height));
        newCrop.width = Math.min(newCrop.width, rect.width - newCrop.x);
        newCrop.height = Math.min(newCrop.height, rect.height - newCrop.y);
        
        return newCrop;
      });
    }
  }, [image, isDragging, isResizing, resizeHandle, dragStart]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // Handle zoom change
  const handleZoomChange = useCallback((value: number[]) => {
    setZoom(value[0]);
  }, []);

  // Handle rotate
  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    if (!image || !containerRef.current) return;
    setZoom(1);
    setRotation(0);
    const rect = containerRef.current.getBoundingClientRect();
    const cropSize = Math.min(300, Math.min(rect.width, rect.height) * 0.8);
    setCropArea({
      x: (rect.width - cropSize) / 2,
      y: (rect.height - cropSize) / 2,
      width: cropSize,
      height: cropSize
    });
  }, [image]);

  // Update canvas preview
  const updateCanvasPreview = useCallback(() => {
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

    // Set canvas size to 400x400
    canvas.width = 400;
    canvas.height = 400;

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
    let destWidth = 400 / zoom;
    let destHeight = 400 / zoom;
    
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
  }, [image, cropArea, zoom, rotation]);

  // Update preview when crop area, zoom, or rotation changes
  useEffect(() => {
    updateCanvasPreview();
  }, [updateCanvasPreview]);

  // Initialize canvas size when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 400;
      canvas.height = 400;
    }
  }, []);

  // Save edited image
  const handleSave = useCallback(async () => {
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

      // Set canvas size to 400x400
      canvas.width = 400;
      canvas.height = 400;

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
      let destWidth = 400 / zoom;
      let destHeight = 400 / zoom;
      
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

      // Convert to data URL with maximum quality (PNG for lossless)
      const dataUrl = canvas.toDataURL('image/png');
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
  }, [image, cropArea, zoom, rotation, onSave, toast]);

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
                  ref={imageRef}
                  src={imageUrl}
                  alt="Edit thumbnail"
                  className="max-w-full max-h-full object-contain"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center'
                  }}
                />
              )}
              
              {/* Crop overlay with resize handles */}
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
                  {/* Resize handles */}
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-pink-500 border border-white cursor-nw-resize"></div>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 border border-white cursor-ne-resize"></div>
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-pink-500 border border-white cursor-sw-resize"></div>
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-pink-500 border border-white cursor-se-resize"></div>
                  
                  {/* Center move icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Move className="h-6 w-6 text-pink-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Preview (400x400):</span>
            <div className="w-32 h-32 border border-gray-300 rounded overflow-hidden bg-gray-100">
              <canvas
                ref={canvasRef}
                width={400}
                height={400}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
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
