// Bundle optimization utilities

// Lazy loading utility for components
export const lazyWithPreload = <T extends React.ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>
) => {
  const LazyComponent = React.lazy(importFunction);
  
  // Add preload method
  (LazyComponent as any).preload = importFunction;
  
  return LazyComponent;
};

// Preload critical routes on user interaction
export const preloadCriticalRoutes = () => {
  const routes = [
    () => import('../pages/Events'),
    () => import('../pages/FindMyFace'),
    () => import('../pages/Booking'),
  ];

  // Preload on user interaction (hover, focus, etc.)
  const preloadOnInteraction = () => {
    routes.forEach(importFn => {
      importFn().catch(err => console.warn('Route preload failed:', err));
    });
  };

  // Listen for first user interaction
  const events = ['mouseenter', 'touchstart', 'focus'];
  const cleanup: (() => void)[] = [];

  events.forEach(event => {
    const handler = () => {
      preloadOnInteraction();
      cleanup.forEach(fn => fn());
    };
    
    document.addEventListener(event, handler, { once: true, passive: true });
    cleanup.push(() => document.removeEventListener(event, handler));
  });

  return () => cleanup.forEach(fn => fn());
};

// Resource hints for better loading
export const addResourceHints = () => {
  const hints = [
    // Preload critical fonts
    { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
    // DNS prefetch for external resources
    { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: '//cdnjs.cloudflare.com' },
    // Preconnect to critical origins
    { rel: 'preconnect', href: 'https://api.example.com' },
  ];

  hints.forEach(hint => {
    const link = document.createElement('link');
    Object.assign(link, hint);
    document.head.appendChild(link);
  });
};

// Service Worker registration for caching
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration.scope);
      
      // Update available
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Show update available notification
              console.log('App update available');
              // You could show a toast here asking user to refresh
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

import React from 'react';