import { useEffect, useRef, useState } from 'react';

interface UseImageLazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  unloadOnExit?: boolean;
}

export const useImageLazyLoading = (
  options: UseImageLazyLoadingOptions = {}
) => {
  const { threshold = 0.1, rootMargin = '50px', unloadOnExit = false } = options;
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (entry.isIntersecting && src) {
            // Load the image
            img.src = src;
            img.onload = () => {
              setLoadedImages(prev => new Set(prev).add(src));
              img.classList.add('loaded');
            };
            
            // Stop observing this image
            observerRef.current?.unobserve(img);
          } else if (!entry.isIntersecting && unloadOnExit && img.src) {
            // Unload image when out of view (for very large galleries)
            img.src = '';
            img.classList.remove('loaded');
            setLoadedImages(prev => {
              const newSet = new Set(prev);
              newSet.delete(src || '');
              return newSet;
            });
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, unloadOnExit]);

  const observe = (element: HTMLImageElement) => {
    if (observerRef.current && element) {
      observerRef.current.observe(element);
    }
  };

  const unobserve = (element: HTMLImageElement) => {
    if (observerRef.current && element) {
      observerRef.current.unobserve(element);
    }
  };

  return {
    observe,
    unobserve,
    isLoaded: (src: string) => loadedImages.has(src),
    loadedCount: loadedImages.size,
  };
};