/**
 * Advanced performance middleware for production deployment
 */

import type { Request, Response, NextFunction } from 'express';
import compression from 'compression';

// Response compression with intelligent algorithm selection
export function createCompressionMiddleware() {
  return compression({
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress responses > 1KB
    filter: (req: Request, res: Response) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Don't compress images or videos (already compressed)
      const contentType = res.get('content-type') || '';
      if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
        return false;
      }
      
      return compression.filter(req, res);
    }
  });
}

// Request/Response caching headers
export function setCacheHeaders(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  
  // Static assets - cache for 1 year
  if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$/)) {
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Expires': new Date(Date.now() + 31536000000).toUTCString()
    });
  }
  // API endpoints - cache for 5 minutes with revalidation
  else if (path.startsWith('/api/events') || path.startsWith('/api/packages')) {
    res.set({
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'ETag': `W/"${Date.now()}"`
    });
  }
  // HTML pages - no cache for dynamic content
  else {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  
  next();
}

// Request rate limiting for API protection
export function createRateLimiter() {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_REQUESTS = 100; // per window
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = requests.get(ip) || { count: 0, resetTime: now + WINDOW_MS };
    
    // Reset if window expired
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + WINDOW_MS;
    }
    
    clientData.count++;
    requests.set(ip, clientData);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS - clientData.count).toString(),
      'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
    });
    
    if (clientData.count > MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }
    
    next();
  };
}

// Request size limiting
export function createBodySizeLimiter(maxSize: string = '50mb') {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: maxSize
      });
    }
    
    next();
  };
}

function parseSize(size: string): number {
  const match = size.match(/^(\d+)(kb|mb|gb)?$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1], 10);
  const unit = (match[2] || '').toLowerCase();
  
  const multipliers = {
    '': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit as keyof typeof multipliers] || 1);
}

// Security headers middleware
export function setSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: https:;
      font-src 'self' data:;
      connect-src 'self' ws: wss: https:;
      media-src 'self' blob:;
    `.replace(/\s+/g, ' ').trim()
  });
  
  next();
}

// Request logging with performance metrics
export function createPerformanceLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalEnd = res.end;
    
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      const size = res.get('content-length') || '0';
      
      // Log slow requests (>2s)
      if (duration > 2000) {
        console.warn(`Slow request: ${req.method} ${req.path} ${duration}ms ${size}bytes`);
      }
      
      // Log large responses (>1MB)
      if (parseInt(size) > 1024 * 1024) {
        console.warn(`Large response: ${req.method} ${req.path} ${size}bytes`);
      }
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
}