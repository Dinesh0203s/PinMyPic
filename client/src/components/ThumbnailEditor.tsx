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
        // Initialize crop area to center of image
        const centerX = (img.width - 200) / 2;
        const centerY = (img.height - 200) / 2;
        setCropArea({
          x: Math.max(0, centerX),
          y: Math.max(0, centerY),
          width: Math.min(200, img.width),
          height: Math.min(200, img.height)
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
        x: Math.max(0, Math.min(newX, image.width - prev.width)),
        y: Math.max(0, Math.min(newY, image.height - prev.height))
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
    if (!image) return;
    setZoom(1);
    setRotation(0);
    const centerX = (image.width - 200) / 2;
    const centerY = (image.height - 200) / 2;
    setCropArea({
      x: Math.max(0, centerX),
      y: Math.max(0, centerY),
      width: Math.min(200, image.width),
      height: Math.min(200, image.height)
    });
  };

  // Save edited image
  const handleSave = async () => {
    if (!image || !canvasRef.current) return;
    
    setIsLoading(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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
      
      // Draw image centered
      ctx.drawImage(
        image,
        cropArea.x, cropArea.y, cropArea.width, cropArea.height,
        -canvas.width / 2 / zoom, -canvas.height / 2 / zoom,
        canvas.width / zoom, canvas.height / zoom
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
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
            <div
              ref={containerRef}
              className="relative cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                width: '100%',
                height: '300px',
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
            >
              {/* Crop overlay */}
              <div
                className="absolute border-2 border-pink-500 bg-pink-500 bg-opacity-20 cursor-move"
                style={{
                  left: `${(cropArea.x / image.width) * 100}%`,
                  top: `${(cropArea.y / image.height) * 100}%`,
                  width: `${(cropArea.width / image.width) * 100}%`,
                  height: `${(cropArea.height / image.height) * 100}%`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Move className="h-6 w-6 text-pink-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Preview:</span>
            <div className="w-20 h-20 border border-gray-300 rounded overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
                style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
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
