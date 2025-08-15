/**
 * Production optimizations and health checks for deployment
 */

import type { Express, Request, Response } from 'express';

export function applyProductionOptimizations(app: Express) {
  // Health check endpoint for deployment monitoring
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Readiness check for deployment orchestration
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      // Check critical dependencies
      const checks = {
        mongodb: await checkMongoConnection(),
        faceService: await checkFaceServiceConnection()
      };

      const allHealthy = Object.values(checks).every(check => check.healthy);

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not ready',
        checks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`${signal} received. Starting graceful shutdown...`);
    
    // Close server connections
    const server = app.get('server');
    if (server) {
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
      
      // Force close after 30 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

async function checkMongoConnection(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const startTime = Date.now();
    const { mongoService } = await import('./mongodb');
    
    // Ensure connection exists
    await mongoService.ensureConnection();
    const db = mongoService.getDb();
    
    // Test with a simple ping
    await db.admin().ping();
    
    const latency = Date.now() - startTime;
    return { healthy: true, latency };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function checkFaceServiceConnection(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('http://localhost:5001/health', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return { healthy: true, latency };
    } else {
      return { healthy: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
}

// Memory cleanup utilities
export function setupMemoryManagement() {
  // Monitor memory usage
  setInterval(() => {
    const usage = process.memoryUsage();
    const mbUsage = {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };

    // Log if memory usage is high (over 512MB heap used)
    if (mbUsage.heapUsed > 512) {
      console.warn(`High memory usage detected: ${JSON.stringify(mbUsage)}MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('Forced garbage collection');
      }
    }
  }, 60000); // Check every minute

  // Handle memory pressure warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      console.warn('Memory leak warning:', warning.message);
    }
  });
}

// Request timeout middleware for production
export function requestTimeoutMiddleware(timeout: number = 30000) {
  return (req: Request, res: Response, next: Function) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request timeout' });
      }
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
}