// Load environment variables from .env file in development
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV !== 'production') {
  const envPath = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
}

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import multer from "multer";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { mongoService } from "./mongodb";

// Global error handlers for production deployment
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production to maintain availability
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately - log and continue for production stability
});
const app = express();

// Initialize MongoDB connection
async function initializeMongoDB() {
  try {
    await mongoService.connect();
    // Test the connection by creating an admin user if needed
    const { mongoStorage } = await import('./mongo-storage');
    const adminEmail = process.env.ADMIN_EMAIL || 'dond2674@gmail.com';
    const existingAdmin = await mongoStorage.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      await mongoStorage.createUser({
        email: adminEmail,
        displayName: 'Dinesh S',
        firebaseUid: 'admin_owner',
        isAdmin: true,
        adminRole: 'owner',
        adminPermissions: ['events', 'bookings', 'packages', 'photos', 'contacts', 'users_view', 'users_manage', 'qr_codes'],
        phone: '',
        isActive: true
      });
      console.log('Admin user created for:', adminEmail);
    }
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error);
  }
}

// Configure multer for file uploads with memory storage (for MongoDB GridFS)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit per file (increased for larger photos)
    files: 200 // Max 200 files for larger batch uploads
  },
  fileFilter: (req, file, cb) => {
    try {
      // Only allow image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        const error = new Error('Only image files are allowed') as any;
        error.code = 'LIMIT_FILE_TYPE';
        cb(error, false);
      }
    } catch (error) {
      console.error('Error in multer fileFilter:', error);
      cb(null, false);
    }
  }
});

// Enable compression for all routes
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress if response is larger than 1KB
  filter: (req: Request, res: Response) => {
    // Don't compress responses if the request is for an image
    if (req.path.startsWith('/api/images/')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Increased payload limits for large photo uploads
app.use(express.json({ limit: '200mb' })); // Increased for large photo batches
app.use(express.urlencoded({ extended: false, limit: '200mb' }));

// Serve static files from uploads directory (for local storage fallback)
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Route to serve images from MongoDB GridFS with optimization
app.get('/api/images/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { thumbnail = 'false', quality = '85', download = 'false' } = req.query;
    const isThumbnail = thumbnail === 'true';
    const isDownload = download === 'true';
    const qualityNum = Math.min(Math.max(parseInt(quality as string), 20), 100);
    
    const { mongoStorage } = await import('./mongo-storage');
    
    const imageData = await mongoStorage.getImageFromGridFS(fileId);
    if (!imageData) {
      // Check if this is a placeholder or static file request
      if (fileId.includes('placeholder') || fileId.includes('.webp') || fileId.includes('.jpg') || fileId.includes('.png')) {
        // Try to serve from static assets
        const path = await import('path');
        const fs = await import('fs');
        
        const staticPaths = [
          path.join(__dirname, '..', 'client', 'public', fileId),
          path.join(__dirname, '..', 'client', 'public', 'placeholder.svg'),
          path.join(__dirname, '..', 'public', fileId)
        ];
        
        for (const staticPath of staticPaths) {
          if (fs.existsSync(staticPath)) {
            const buffer = fs.readFileSync(staticPath);
            const ext = path.extname(staticPath).toLowerCase();
            const contentType = ext === '.svg' ? 'image/svg+xml' : 
                              ext === '.webp' ? 'image/webp' :
                              ext === '.png' ? 'image/png' : 'image/jpeg';
            
            res.set('Cache-Control', 'public, max-age=3600');
            res.set('Content-Type', contentType);
            res.end(buffer);
            return;
          }
        }
      }
      
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if this is a pre-generated thumbnail request
    const isPreGeneratedThumbnail = imageData.buffer && 
      imageData.contentType === 'image/webp' &&
      imageData.buffer.length < 200000; // Likely a thumbnail if WebP and under 200KB
    
    // If this is already a pre-generated thumbnail, serve it directly
    if (isPreGeneratedThumbnail) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Content-Type', 'image/webp');
      res.set('X-Thumbnail-Type', 'pre-generated-webp');
      res.end(imageData.buffer);
      return;
    }
    
    // Set appropriate headers for performance
    let contentType = imageData.contentType;
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    res.set('ETag', `"${fileId}${isThumbnail ? '-thumb' : ''}${isDownload ? '-orig' : ''}"`);
    res.set('Vary', 'Accept-Encoding');
    
    // Add performance headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Accept-Ranges', 'bytes');
    
    // For downloads, serve original quality without compression
    if (isDownload) {
      // Get proper filename with default fallback
      const filename = `photo_${fileId}.jpg`;
      
      res.set('Content-Type', imageData.contentType);
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('X-Image-Type', 'original-download');
      
      // Serve original file without any processing
      res.end(imageData.buffer);
      return;
    }
    
    // Check if client supports WebP
    const acceptsWebP = req.headers.accept?.includes('image/webp');
    
    // For display (thumbnails or compressed versions), use Sharp for compression
    if (imageData.contentType.startsWith('image/')) {
      try {
        const sharp = await import('sharp');
        
        // Use the buffer directly from GridFS
        const imageBuffer = imageData.buffer;
        
        let processedImage = sharp.default(imageBuffer);
        
        // First, check the original metadata
        let originalMetadata;
        try {
          originalMetadata = await processedImage.metadata();
        } catch (metaError: any) {
          console.log('Could not read original metadata:', metaError?.message);
        }
        
        // Set performance headers
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('X-Content-Type-Options', 'nosniff');
        
        // Apply explicit EXIF orientation correction
        if (originalMetadata?.orientation && originalMetadata.orientation !== 1) {
          console.log(`Applying orientation correction: ${originalMetadata.orientation}`);
          
          // Apply specific rotation based on EXIF orientation value
          switch (originalMetadata.orientation) {
            case 2:
              processedImage = processedImage.flop();
              break;
            case 3:
              processedImage = processedImage.rotate(180);
              break;
            case 4:
              processedImage = processedImage.flip();
              break;
            case 5:
              processedImage = processedImage.rotate(90).flop();
              break;
            case 6:
              processedImage = processedImage.rotate(90);
              break;
            case 7:
              processedImage = processedImage.rotate(270).flop();
              break;
            case 8:
              processedImage = processedImage.rotate(270);
              break;
          }
        }
        

        
        // For thumbnails, resize to max 300px while maintaining aspect ratio
        if (isThumbnail) {
          processedImage = processedImage.resize(300, 300, {
            fit: 'inside',
            withoutEnlargement: true
          });
        } else {
          // For regular display, resize to max 600px for better loading performance
          processedImage = processedImage.resize(600, 600, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        // Convert to WebP if supported for better compression
        if (acceptsWebP) {
          // For thumbnails, use higher quality; for regular images, use quality-based compression
          const webpOptions = isThumbnail 
            ? { quality: 85, effort: 3, smartSubsample: true } // Higher quality for thumbnails
            : { quality: qualityNum, effort: 4, smartSubsample: true }; // Quality-based for regular images
            
          const webpBuffer = await processedImage
            .webp(webpOptions)
            .toBuffer();
          
          res.set('Content-Type', 'image/webp');
          res.set('Content-Length', webpBuffer.length.toString());
          res.set('X-Image-Type', isThumbnail ? 'thumbnail-webp-lossless' : 'compressed-webp');
          res.set('X-Image-Size', `${webpBuffer.length}`);
          res.send(webpBuffer);
        } else {
          // For JPEG: thumbnails use higher quality for better visual appearance, regular images use balanced quality
          const jpegQuality = isThumbnail ? 85 : qualityNum;
          const jpegBuffer = await processedImage
            .jpeg({ 
              quality: jpegQuality, 
              progressive: true,
              mozjpeg: true, // Use mozjpeg encoder for better compression
              optimizeScans: true,
              trellisQuantisation: true
            })
            .toBuffer();
          
          res.set('Content-Type', 'image/jpeg');
          res.set('X-Image-Type', isThumbnail ? 'thumbnail-jpeg-hq' : 'compressed-jpeg');
          res.send(jpegBuffer);
        }
        
      } catch (sharpError) {
        console.error('Error processing image with Sharp:', sharpError);
        // Fallback to original image
        res.set('Content-Type', imageData.contentType);
        res.end(imageData.buffer);
      }
    } else {
      // Non-image files, serve as-is
      res.set('Content-Type', imageData.contentType);
      res.end(imageData.buffer);
    }
    
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Add multer middleware only for POST requests to photo upload endpoint
app.post('/api/photos/upload', (req, res, next) => {
  upload.array('photos', 200)(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      
      if (err.code === 'LIMIT_FILE_TYPE') {
        return res.status(400).json({ error: 'Only image files are allowed' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max size is 100MB per file' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Max 200 files allowed' });
      }
      
      // Generic error
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize MongoDB connection
  await initializeMongoDB();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 3000;
  server.listen(port,'0.0.0.0', () => {
    log(`serving on port ${port}`);
  });
})();
