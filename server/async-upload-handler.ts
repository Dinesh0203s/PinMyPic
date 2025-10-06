/**
 * Async Upload Handler for Large Batch Photo Uploads
 * Handles 10,000+ photos efficiently with background processing
 */

import { Express } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface UploadJob {
  id: string;
  eventId: string;
  userId: string;
  totalFiles: number;
  processedFiles: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

class AsyncUploadHandler {
  private uploadJobs = new Map<string, UploadJob>();
  
  /**
   * Process large uploads asynchronously
   */
  async handleLargeUpload(
    files: Express.Multer.File[], 
    eventId: string, 
    userId: string
  ): Promise<{ jobId: string; message: string }> {
    const jobId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create upload job
    const job: UploadJob = {
      id: jobId,
      eventId,
      userId,
      totalFiles: files.length,
      processedFiles: 0,
      status: 'queued',
      startTime: new Date(),
      errors: []
    };
    
    this.uploadJobs.set(jobId, job);
    
    // Process upload in background
    this.processUploadAsync(files, eventId, userId, jobId);
    
    return {
      jobId,
      message: `Upload job created. Processing ${files.length} photos in background.`
    };
  }
  
  /**
   * Process files asynchronously without blocking the response
   */
  private async processUploadAsync(
    files: Express.Multer.File[], 
    eventId: string, 
    userId: string,
    jobId: string
  ): Promise<void> {
    const job = this.uploadJobs.get(jobId);
    if (!job) return;
    
    job.status = 'processing';
    
    try {
      const { storage } = await import('./storage');
      const { mongoStorage } = await import('./mongo-storage');
      const { faceProcessingQueue } = await import('./face-processing-queue');
      const sharp = await import('sharp');
      
      // Process files in parallel batches
      const PARALLEL_BATCH_SIZE = 20; // Process 20 files at once
      const batches = [];
      
      for (let i = 0; i < files.length; i += PARALLEL_BATCH_SIZE) {
        batches.push(files.slice(i, i + PARALLEL_BATCH_SIZE));
      }
      
      console.log(`Processing ${files.length} files in ${batches.length} parallel batches for job ${jobId}`);
      
      // Process each batch
      for (const batch of batches) {
        await Promise.all(batch.map(async (file) => {
          try {
            const multerFile = file as Express.Multer.File;
            const filename = `${eventId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${multerFile.originalname}`;
            
            // Save to local storage
            const uploadsDir = path.join(__dirname, '..', 'uploads', eventId);
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const localFilePath = path.join(uploadsDir, filename);
            fs.writeFileSync(localFilePath, multerFile.buffer);
            
            // Upload to MongoDB GridFS
            const fileId = await mongoStorage.uploadImageToGridFS(
              multerFile.buffer, 
              filename,
              multerFile.mimetype
            );
            
            // Generate thumbnail (non-blocking)
            let thumbnailId;
            try {
              const thumbnailBuffer = await sharp.default(multerFile.buffer)
                .resize(300, 300, {
                  fit: 'inside',
                  withoutEnlargement: true
                })
                .webp({ quality: 80, effort: 4 })
                .toBuffer();
              
              thumbnailId = await mongoStorage.uploadThumbnailToGridFS(
                thumbnailBuffer,
                filename,
                fileId
              );
            } catch (thumbnailError) {
              console.warn(`Thumbnail generation failed for ${filename}:`, thumbnailError);
            }
            
            // Create photo record
            const photoData = {
              eventId,
              filename: filename,
              url: `/api/images/${fileId}`,
              thumbnailUrl: thumbnailId ? `/api/images/${thumbnailId}` : `/api/images/${fileId}`,
              thumbnailId: thumbnailId,
              tags: '',
              isProcessed: false,
              uploadJobId: jobId
            };
            
            const photo = await storage.createPhoto(photoData);
            
            // Add to face processing queue with low priority
            await faceProcessingQueue.addToQueue(
              photo.id, 
              localFilePath, 
              userId,
              'low' // Low priority for large batch uploads
            );
            
            // Update job progress
            job.processedFiles++;
            
            // Log progress every 100 files
            if (job.processedFiles % 100 === 0) {
              console.log(`Job ${jobId}: Processed ${job.processedFiles}/${job.totalFiles} files`);
            }
            
          } catch (error) {
            console.error(`Error processing file in job ${jobId}:`, error);
            job.errors.push(`Failed to process ${file.originalname}: ${error}`);
          }
        }));
      }
      
      // Update event photo count
      const event = await storage.getEvent(eventId);
      if (event) {
        const newPhotoCount = (event.photoCount || 0) + job.processedFiles;
        await storage.updateEvent(eventId, { photoCount: newPhotoCount });
      }
      
      // Mark job as completed
      job.status = 'completed';
      job.endTime = new Date();
      
      console.log(`Upload job ${jobId} completed: ${job.processedFiles}/${job.totalFiles} files processed`);
      
    } catch (error) {
      console.error(`Upload job ${jobId} failed:`, error);
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push(`Job failed: ${error}`);
    }
  }
  
  /**
   * Get upload job status
   */
  getJobStatus(jobId: string): UploadJob | null {
    return this.uploadJobs.get(jobId) || null;
  }
  
  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): UploadJob[] {
    return Array.from(this.uploadJobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }
  
  /**
   * Clean up old completed jobs (run periodically)
   */
  cleanupOldJobs(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [jobId, job] of Array.from(this.uploadJobs.entries())) {
      if (job.status === 'completed' && job.endTime && job.endTime < oneHourAgo) {
        this.uploadJobs.delete(jobId);
      }
    }
  }
}

// Export singleton instance
export const asyncUploadHandler = new AsyncUploadHandler();

// Clean up old jobs every 30 minutes
setInterval(() => {
  asyncUploadHandler.cleanupOldJobs();
}, 30 * 60 * 1000);
