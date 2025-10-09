// Google Analytics utility functions for SEO tracking

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

// Initialize Google Analytics
export const initializeAnalytics = (measurementId: string) => {
  if (typeof window === 'undefined') return;

  // Load Google Analytics script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.gtag = window.gtag || function() {
    (window.gtag as any).q = (window.gtag as any).q || [];
    (window.gtag as any).q.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_title: document.title,
    page_location: window.location.href,
  });
};

// Track page views
export const trackPageView = (url: string, title?: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('config', 'GA_MEASUREMENT_ID', {
    page_title: title || document.title,
    page_location: url,
  });
};

// Track custom events
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Track photography-specific events
export const trackPhotographyEvents = {
  photoSearch: (eventId: string) => {
    trackEvent('photo_search', 'photography', eventId);
  },
  
  photoDownload: (eventId: string, photoCount: number) => {
    trackEvent('photo_download', 'photography', eventId, photoCount);
  },
  
  faceRecognition: (eventId: string, matchCount: number) => {
    trackEvent('face_recognition', 'ai_technology', eventId, matchCount);
  },
  
  bookingInquiry: (eventType: string) => {
    trackEvent('booking_inquiry', 'business', eventType);
  },
  
  eventView: (eventId: string, eventTitle: string) => {
    trackEvent('event_view', 'photography', `${eventId}_${eventTitle}`);
  }
};

// Track Core Web Vitals
export const trackWebVitals = () => {
  if (typeof window === 'undefined') return;

  // Track Largest Contentful Paint (LCP)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    trackEvent('web_vital', 'performance', 'LCP', Math.round(lastEntry.startTime));
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // Track First Input Delay (FID)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry) => {
      trackEvent('web_vital', 'performance', 'FID', Math.round(entry.processingStart - entry.startTime));
    });
  }).observe({ entryTypes: ['first-input'] });

  // Track Cumulative Layout Shift (CLS)
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry) => {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
      }
    });
    trackEvent('web_vital', 'performance', 'CLS', Math.round(clsValue * 1000));
  }).observe({ entryTypes: ['layout-shift'] });
};

// Track SEO-related metrics
export const trackSEOMetrics = {
  searchResultClick: (query: string, position: number) => {
    trackEvent('search_click', 'seo', query, position);
  },
  
  socialShare: (platform: string, content: string) => {
    trackEvent('social_share', 'seo', `${platform}_${content}`);
  },
  
  externalLink: (url: string) => {
    trackEvent('external_link', 'seo', url);
  }
};
