import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

interface FolderMonitorConfig {
  userId: string;
  eventId: string;
  folderPath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class FolderMonitorService {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private configs: Map<string, FolderMonitorConfig> = new Map();

  /**
   * Start monitoring a folder for new images
   */
  async startMonitoring(userId: string, eventId: string, folderPath: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate folder path exists
      if (!fs.existsSync(folderPath)) {
        return { success: false, message: 'Folder path does not exist' };
      }

      // Check if folder is already being monitored for this user
      const existingKey = Array.from(this.configs.keys()).find(key => {
        const config = this.configs.get(key);
        return config?.userId === userId && config?.folderPath === folderPath;
      });

      if (existingKey) {
        // Update existing monitor with new event
        const config = this.configs.get(existingKey)!;
        config.eventId = eventId;
        config.updatedAt = new Date();
        return { success: true, message: 'Folder monitor updated with new event' };
      }

      // Create unique key for this monitor
      const monitorKey = `${userId}-${Date.now()}`;
      
      // Create configuration
      const config: FolderMonitorConfig = {
        userId,
        eventId,
        folderPath: path.resolve(folderPath),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set up file watcher
      const watcher = chokidar.watch(folderPath, {
        ignored: /^\./, // ignore dotfiles
        persistent: true,
        ignoreInitial: true, // only watch for new files, not existing ones
        awaitWriteFinish: {
          stabilityThreshold: 2000, // wait 2 seconds after file stops changing
          pollInterval: 100
        }
      });

      // Handle new files
      watcher.on('add', async (filePath) => {
        await this.handleNewFile(filePath, config);
      });

      // Handle errors
      watcher.on('error', (error) => {
        console.error(`Folder monitor error for ${folderPath}:`, error);
      });

      // Store watcher and config
      this.watchers.set(monitorKey, watcher);
      this.configs.set(monitorKey, config);

      console.log(`Started monitoring folder: ${folderPath} for user: ${userId}, event: ${eventId}`);
      return { success: true, message: `Started monitoring folder: ${path.basename(folderPath)}` };

    } catch (error) {
      console.error('Error starting folder monitor:', error);
      return { success: false, message: 'Failed to start folder monitoring' };
    }
  }

  /**
   * Stop monitoring a specific folder
   */
  async stopMonitoring(userId: string, folderPath?: string): Promise<{ success: boolean; message: string }> {
    try {
      const keysToRemove: string[] = [];

      // Find monitors to stop
      this.configs.forEach((config, key) => {
        if (config.userId === userId && (!folderPath || config.folderPath === path.resolve(folderPath))) {
          keysToRemove.push(key);
        }
      });

      if (keysToRemove.length === 0) {
        return { success: false, message: 'No active folder monitors found' };
      }

      // Stop watchers and cleanup
      for (const key of keysToRemove) {
        const watcher = this.watchers.get(key);
        if (watcher) {
          await watcher.close();
          this.watchers.delete(key);
        }
        this.configs.delete(key);
      }

      const message = folderPath 
        ? `Stopped monitoring folder: ${path.basename(folderPath)}`
        : `Stopped monitoring ${keysToRemove.length} folder(s)`;

      console.log(message);
      return { success: true, message };

    } catch (error) {
      console.error('Error stopping folder monitor:', error);
      return { success: false, message: 'Failed to stop folder monitoring' };
    }
  }

  /**
   * Get active monitors for a user
   */
  getActiveMonitors(userId: string): FolderMonitorConfig[] {
    return Array.from(this.configs.values()).filter(config => 
      config.userId === userId && config.isActive
    );
  }

  /**
   * Handle new file detected in monitored folder
   */
  private async handleNewFile(filePath: string, config: FolderMonitorConfig): Promise<void> {
    try {
      // Check if file is an image
      const ext = path.extname(filePath).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
      
      if (!imageExtensions.includes(ext)) {
        return; // Skip non-image files
      }

      console.log(`New image detected: ${path.basename(filePath)} for event: ${config.eventId}`);

      // Read and process the image
      const imageBuffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);

      // Process and upload the image
      await this.processAndUploadImage(imageBuffer, filename, config);

    } catch (error) {
      console.error(`Error handling new file ${filePath}:`, error);
    }
  }

  /**
   * Process and upload image to the event
   */
  private async processAndUploadImage(imageBuffer: Buffer, filename: string, config: FolderMonitorConfig): Promise<void> {
    try {
      const { storage } = await import('./storage');
      const faceProcessingQueue = await import('./face-processing-queue');

      // Generate unique filename to avoid conflicts
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}-${filename}`;
      const fileReference = path.join(__dirname, '..', 'uploads', uniqueFilename);

      // Ensure uploads directory exists
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Optimize image using sharp
      let processedBuffer = imageBuffer;
      try {
        const metadata = await sharp(imageBuffer).metadata();
        
        // Only compress if image is large
        if (metadata.width && metadata.width > 2000) {
          processedBuffer = await sharp(imageBuffer)
            .resize(2000, null, { withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();
        }
      } catch (sharpError) {
        console.warn('Sharp processing failed, using original image:', sharpError);
      }

      // Save processed image temporarily
      fs.writeFileSync(fileReference, processedBuffer);

      // Create photo record in database
      const photoData = {
        filename: uniqueFilename,
        url: `/uploads/${uniqueFilename}`, // Required URL field
        eventId: config.eventId,
        isProcessed: false
      };

      const photoId = await storage.createPhoto(photoData);

      // Add to face processing queue with high priority (automatic uploads)
      const queueResult = await faceProcessingQueue.faceProcessingQueue.addToQueue(photoId.toString(), fileReference, config.userId, 'high');
      
      if (queueResult.success) {
        console.log(`Image uploaded successfully: ${filename} -> Event: ${config.eventId}`);
      } else {
        console.error(`Failed to add image to processing queue: ${queueResult.message}`);
      }

    } catch (error) {
      console.error(`Error processing and uploading image ${filename}:`, error);
    }
  }

  /**
   * Cleanup all watchers (called on server shutdown)
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up folder monitors...');
    
    this.watchers.forEach(async (watcher, key) => {
      try {
        await watcher.close();
      } catch (error) {
        console.error(`Error closing watcher ${key}:`, error);
      }
    });

    // Clear configs and watchers after cleanup
    this.configs.clear();
    this.watchers.clear();
  }
}

// Export singleton instance
export const folderMonitorService = new FolderMonitorService();

// Cleanup on process exit
process.on('SIGINT', async () => {
  await folderMonitorService.cleanup();
});

process.on('SIGTERM', async () => {
  await folderMonitorService.cleanup();
});