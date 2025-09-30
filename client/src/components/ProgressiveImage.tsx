import { useState, useRef, useEffect, useMemo } from 'react';
import { imagePreloader, getDisplayImageUrl } from '@/utils/imagePreloader';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  thumbnailSrc?: string;
  priority?: 'low' | 'medium' | 'high';
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  aspectRatio?: number;
  blur?: boolean;
}

const ProgressiveImage = ({
  src,
  alt,
  className = '',
  thumbnailSrc,
  priority = 'medium',
  onLoad,
  onError,
  style,
  sizes,
  loading = 'lazy',
  aspectRatio,
  blur = true
}: ProgressiveImageProps) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [isInView, setIsInView] = useState(loading === 'eager');
  const [showFullRes, setShowFullRes] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate optimized URLs for progressive loading
  const optimizedSrc = useMemo(() => {
    // For GridFS images, use full quality WebP for final image
    if (src.startsWith('/api/images/')) {
      return `${src}?quality=100&format=webp`;
    }
    return getDisplayImageUrl(src);
  }, [src]);
  
  const thumb = useMemo(() => {
    if (thumbnailSrc) return thumbnailSrc;
    // For GridFS images, use small thumbnail with blur effect
    if (src.startsWith('/api/images/')) {
      return `${src}?thumbnail=true&quality=60&format=webp`;
    }
    return getDisplayImageUrl(src, true);
  }, [src, thumbnailSrc]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'eager') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [loading]);

  // Progressive loading with blur-up technique
  useEffect(() => {
    if (!isInView) return;

    let isCancelled = false;

    // Load thumbnail first with blur effect
    const loadThumbnail = (src: string) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = src;
      });
    };

    // Load full resolution image
    const loadFullImage = (src: string) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = src;
      });
    };

    // Start with thumbnail (blurred)
    loadThumbnail(thumb)
      .then(() => {
        if (isCancelled) return;
        setImageState('loaded');
        // Keep blur effect for now
        
        // Then load full resolution
        return loadFullImage(optimizedSrc);
      })
      .then(() => {
        if (isCancelled) return;
        setShowFullRes(true);
        onLoad?.();
      })
      .catch(() => {
        if (isCancelled) return;
        setImageState('error');
        onError?.();
      });

    return () => {
      isCancelled = true;
    };
  }, [isInView, thumb, optimizedSrc, onLoad, onError, priority]);

  // Generate placeholder with proper aspect ratio
  const placeholderStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#9ca3af',
      fontSize: '14px',
      ...style
    };

    if (aspectRatio) {
      baseStyle.aspectRatio = aspectRatio.toString();
    }

    return baseStyle;
  }, [style, aspectRatio]);

  const imageStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      transition: 'opacity 0.3s ease-in-out',
      ...style
    };

    if (aspectRatio) {
      baseStyle.aspectRatio = aspectRatio.toString();
      baseStyle.objectFit = 'cover';
    }

    return baseStyle;
  }, [style, aspectRatio]);

  // Error fallback
  if (imageState === 'error') {
    return (
      <div 
        ref={containerRef}
        className={`${className} flex items-center justify-center bg-gray-100`}
        style={placeholderStyle}
      >
        <span className="text-gray-500">Image unavailable</span>
      </div>
    );
  }

  // Not in viewport yet
  if (!isInView) {
    return (
      <div 
        ref={containerRef}
        className={`${className} animate-pulse bg-gray-200`}
        style={placeholderStyle}
      >
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} style={style}>
      {/* Blurred thumbnail layer */}
      {imageState === 'loaded' && (
        <img
          src={thumb}
          alt=""
          className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
            showFullRes ? 'opacity-0' : 'opacity-100'
          } filter blur-sm`}
          style={imageStyle}
          loading="eager"
        />
      )}

      {/* Full resolution layer */}
      {showFullRes && (
        <img
          ref={imgRef}
          src={optimizedSrc}
          alt={alt}
          className={`w-full h-full transition-opacity duration-500 ${
            showFullRes ? 'opacity-100' : 'opacity-0'
          }`}
          style={imageStyle}
          sizes={sizes}
          loading="eager"
        />
      )}

      {/* Loading placeholder */}
      {imageState === 'loading' && (
        <div 
          className={`absolute inset-0 animate-pulse bg-gray-200 flex items-center justify-center`}
          style={placeholderStyle}
        >
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default ProgressiveImage;