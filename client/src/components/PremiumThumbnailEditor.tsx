import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Crop, 
  Save, 
  X, 
  Maximize2,
  Square,
  Monitor,
  Smartphone,
  Tablet,
  Download,
  Undo,
  Redo,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PremiumThumbnailEditorProps {
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

interface AspectRatio {
  label: string;
  value: number;
  icon: React.ReactNode;
}

const ASPECT_RATIOS: AspectRatio[] = [
  { label: 'Free', value: 0, icon: <Crop className="h-4 w-4" /> },
  { label: '1:1', value: 1, icon: <Square className="h-4 w-4" /> },
  { label: '4:3', value: 4/3, icon: <Monitor className="h-4 w-4" /> },
  { label: '3:4', value: 3/4, icon: <Smartphone className="h-4 w-4" /> },
  { label: '16:9', value: 16/9, icon: <Monitor className="h-4 w-4" /> },
  { label: '9:16', value: 9/16, icon: <Smartphone className="h-4 w-4" /> },
  { label: '3:2', value: 3/2, icon: <Tablet className="h-4 w-4" /> },
  { label: '2:3', value: 2/3, icon: <Tablet className="h-4 w-4" /> },
];

export function PremiumThumbnailEditor({ imageUrl, open, onOpenChange, onSave }: PremiumThumbnailEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 400, height: 400 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[1]); // Default to 1:1
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState<CropArea[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
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
        const containerWidth = 500;
        const containerHeight = 400;
        const cropSize = Math.min(300, Math.min(containerWidth, containerHeight) * 0.8);
        
        const initialCrop = {
          x: (containerWidth - cropSize) / 2,
          y: (containerHeight - cropSize) / 2,
          width: cropSize,
          height: cropSize
        };
        
        setCropArea(initialCrop);
        setHistory([initialCrop]);
        setHistoryIndex(0);
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
      
      const initialCrop = {
        x: (rect.width - cropSize) / 2,
        y: (rect.height - cropSize) / 2,
        width: cropSize,
        height: cropSize
      };
      
      setCropArea(initialCrop);
      setHistory([initialCrop]);
      setHistoryIndex(0);
    }
  }, [image, open]);

  // Apply aspect ratio constraint
  const applyAspectRatio = useCallback((newCrop: CropArea, aspectRatio: number) => {
    if (aspectRatio === 0) return newCrop; // Free aspect ratio
    
    const currentAspectRatio = newCrop.width / newCrop.height;
    
    if (currentAspectRatio > aspectRatio) {
      // Too wide, adjust width
      newCrop.width = newCrop.height * aspectRatio;
    } else {
      // Too tall, adjust height
      newCrop.height = newCrop.width / aspectRatio;
    }
    
    return newCrop;
  }, []);

  // Add to history
  const addToHistory = useCallback((newCrop: CropArea) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCrop);
    if (newHistory.length > 20) newHistory.shift(); // Limit history to 20 items
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!image || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on resize handles
    const handleSize = 12;
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
      const newCrop = {
        ...cropArea,
        x: Math.max(0, Math.min(x - dragStart.x, rect.width - cropArea.width)),
        y: Math.max(0, Math.min(y - dragStart.y, rect.height - cropArea.height))
      };
      setCropArea(newCrop);
    } else if (isResizing && resizeHandle) {
      let newCrop = { ...cropArea };
      
      switch (resizeHandle) {
        case 'nw':
          newCrop.x = Math.max(0, x);
          newCrop.y = Math.max(0, y);
          newCrop.width = Math.max(50, cropArea.x + cropArea.width - x);
          newCrop.height = Math.max(50, cropArea.y + cropArea.height - y);
          break;
        case 'ne':
          newCrop.y = Math.max(0, y);
          newCrop.width = Math.max(50, x - cropArea.x);
          newCrop.height = Math.max(50, cropArea.y + cropArea.height - y);
          break;
        case 'sw':
          newCrop.x = Math.max(0, x);
          newCrop.width = Math.max(50, cropArea.x + cropArea.width - x);
          newCrop.height = Math.max(50, y - cropArea.y);
          break;
        case 'se':
          newCrop.width = Math.max(50, x - cropArea.x);
          newCrop.height = Math.max(50, y - cropArea.y);
          break;
      }
      
      // Apply aspect ratio constraint
      newCrop = applyAspectRatio(newCrop, selectedAspectRatio.value);
      
      // Keep within container bounds
      newCrop.x = Math.max(0, Math.min(newCrop.x, rect.width - newCrop.width));
      newCrop.y = Math.max(0, Math.min(newCrop.y, rect.height - newCrop.height));
      newCrop.width = Math.min(newCrop.width, rect.width - newCrop.x);
      newCrop.height = Math.min(newCrop.height, rect.height - newCrop.y);
      
      setCropArea(newCrop);
    }
  }, [image, isDragging, isResizing, resizeHandle, dragStart, cropArea, selectedAspectRatio, applyAspectRatio]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      addToHistory(cropArea);
    }
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, [isDragging, isResizing, cropArea, addToHistory]);

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
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    const rect = containerRef.current.getBoundingClientRect();
    const cropSize = Math.min(300, Math.min(rect.width, rect.height) * 0.8);
    const resetCrop = {
      x: (rect.width - cropSize) / 2,
      y: (rect.height - cropSize) / 2,
      width: cropSize,
      height: cropSize
    };
    setCropArea(resetCrop);
    addToHistory(resetCrop);
  }, [image, addToHistory]);

  // Handle aspect ratio change
  const handleAspectRatioChange = useCallback((aspectRatio: AspectRatio) => {
    setSelectedAspectRatio(aspectRatio);
    const newCrop = applyAspectRatio(cropArea, aspectRatio.value);
    setCropArea(newCrop);
    addToHistory(newCrop);
  }, [cropArea, applyAspectRatio, addToHistory]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCropArea(history[historyIndex - 1]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCropArea(history[historyIndex + 1]);
    }
  }, [historyIndex, history]);

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
    
    // Apply filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
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
  }, [image, cropArea, zoom, rotation, brightness, contrast, saturation]);

  // Update preview when crop area, zoom, or rotation changes
  useEffect(() => {
    updateCanvasPreview();
  }, [updateCanvasPreview]);

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
      
      // Apply filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      
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
        description: "Premium thumbnail created successfully",
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
  }, [image, cropArea, zoom, rotation, brightness, contrast, saturation, onSave, toast]);

  if (!image) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5" />
              Premium Thumbnail Editor
            </DialogTitle>
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
      <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Premium Thumbnail Editor
            <Badge variant="secondary" className="ml-2">400x400</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Advanced Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
            {/* Aspect Ratio Presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Aspect Ratio</label>
              <div className="flex flex-wrap gap-1">
                {ASPECT_RATIOS.map((ratio) => (
                  <Button
                    key={ratio.label}
                    variant={selectedAspectRatio.label === ratio.label ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAspectRatioChange(ratio)}
                    className="flex items-center gap-1"
                  >
                    {ratio.icon}
                    {ratio.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Zoom and Rotation */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                <span className="text-sm font-medium">Zoom:</span>
                <Slider
                  value={[zoom]}
                  onValueChange={handleZoomChange}
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 w-12">{Math.round(zoom * 100)}%</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Rotate
                </Button>
                <span className="text-sm text-gray-600">{rotation}°</span>
              </div>
            </div>

            {/* History Controls */}
            <div className="space-y-2">
              <label className="text-sm font-medium">History</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="flex items-center gap-1"
                >
                  <Undo className="h-4 w-4" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="flex items-center gap-1"
                >
                  <Redo className="h-4 w-4" />
                  Redo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Image Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brightness</label>
              <Slider
                value={[brightness]}
                onValueChange={(value) => setBrightness(value[0])}
                min={0}
                max={200}
                step={1}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{brightness}%</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Contrast</label>
              <Slider
                value={[contrast]}
                onValueChange={(value) => setContrast(value[0])}
                min={0}
                max={200}
                step={1}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{contrast}%</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Saturation</label>
              <Slider
                value={[saturation]}
                onValueChange={(value) => setSaturation(value[0])}
                min={0}
                max={200}
                step={1}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{saturation}%</span>
            </div>
          </div>

          {/* Image Editor */}
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <div
              ref={containerRef}
              className="relative cursor-move min-h-[500px] flex items-center justify-center"
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
                    transformOrigin: 'center',
                    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
                  }}
                />
              )}
              
              {/* Grid overlay */}
              {showGrid && image && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${cropArea.x}px`,
                    top: `${cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                  }}
                >
                  {/* Rule of thirds grid */}
                  <div className="absolute inset-0 border border-pink-300 opacity-50">
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-pink-300 opacity-50"></div>
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-pink-300 opacity-50"></div>
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-pink-300 opacity-50"></div>
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-pink-300 opacity-50"></div>
                  </div>
                </div>
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
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-pink-500 border-2 border-white rounded-full cursor-nw-resize shadow-lg"></div>
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-pink-500 border-2 border-white rounded-full cursor-ne-resize shadow-lg"></div>
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-pink-500 border-2 border-white rounded-full cursor-sw-resize shadow-lg"></div>
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-pink-500 border-2 border-white rounded-full cursor-se-resize shadow-lg"></div>
                  
                  {/* Center move icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Move className="h-8 w-8 text-pink-500 drop-shadow-lg" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview and Info */}
          <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Preview (400x400):</span>
              <div className="w-32 h-32 border border-gray-300 rounded overflow-hidden bg-gray-100 shadow-lg">
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
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
                className="flex items-center gap-1"
              >
                {showGrid ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Grid
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex justify-between items-center pt-4 border-t bg-white">
          <div className="text-sm text-gray-600">
            Crop: {Math.round(cropArea.width)}×{Math.round(cropArea.height)}px
          </div>
          <div className="flex gap-3">
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
              className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isLoading ? 'Creating...' : 'Create Premium Thumbnail'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
