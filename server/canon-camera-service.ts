import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export interface CameraInfo {
  productname: string;
  serialnumber: string;
  macaddress: string;
  firmwareversion: string;
  battery: {
    level: number;
    kind: string;
  };
}

export interface CameraSettings {
  av: string;
  tv: string;
  iso: string;
  white_balance: string;
  picture_style: string;
}

export interface TransferSettings {
  autoTransfer: boolean;
  eventId?: string;
  quality: 'original' | 'compressed';
  deleteAfterTransfer: boolean;
}

export class CanonCameraService extends EventEmitter {
  private cameraIP: string | null = null;
  private cameraPort: number = 8080;
  private connected: boolean = false;
  private polling: boolean = false;
  private connectionType: 'wireless' | 'usb' | null = null;
  private transferSettings: TransferSettings = {
    autoTransfer: false,
    quality: 'compressed',
    deleteAfterTransfer: false
  };
  private lastImageIndex: number = 0;

  constructor() {
    super();
  }

  /**
   * Connect to Canon R10 camera via CCAPI (wireless) or USB
   */
  async connect(ip?: string, port: number = 8080): Promise<boolean> {
    try {
      // If no IP provided, try USB connection first
      if (!ip) {
        return await this.connectUSB();
      }

      // Try wireless connection
      this.cameraIP = ip;
      this.cameraPort = port;
      this.connectionType = 'wireless';

      // Test connection by getting device info
      const info = await this.getCameraInfo();
      if (info) {
        this.connected = true;
        this.emit('connected', { info, type: 'wireless' });
        console.log(`Connected wirelessly to Canon ${info.productname} (${info.serialnumber})`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to connect to camera:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Connect to Canon camera via USB
   */
  async connectUSB(): Promise<boolean> {
    try {
      // For USB connection, Canon CCAPI typically runs on localhost
      const usbHosts = ['localhost', '127.0.0.1'];
      const usbPorts = [8080, 8000, 80];

      for (const host of usbHosts) {
        for (const port of usbPorts) {
          try {
            this.cameraIP = host;
            this.cameraPort = port;
            this.connectionType = 'usb';

            const info = await this.getCameraInfo();
            if (info) {
              this.connected = true;
              this.emit('connected', { info, type: 'usb' });
              console.log(`Connected via USB to Canon ${info.productname} (${info.serialnumber})`);
              return true;
            }
          } catch (usbError) {
            // Continue trying other ports/hosts
            continue;
          }
        }
      }

      // If no USB connection found, reset
      this.cameraIP = null;
      this.connectionType = null;
      return false;
    } catch (error) {
      console.error('Failed to connect via USB:', error);
      this.connected = false;
      this.connectionType = null;
      return false;
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus() {
    return {
      connected: this.connected,
      type: this.connectionType,
      ip: this.cameraIP,
      port: this.cameraPort,
      transferSettings: this.transferSettings
    };
  }

  /**
   * Disconnect from camera
   */
  disconnect(): void {
    this.connected = false;
    this.cameraIP = null;
    this.connectionType = null;
    this.stopPolling();
    this.emit('disconnected');
    console.log('Disconnected from camera');
  }

  /**
   * Get camera information
   */
  async getCameraInfo(): Promise<CameraInfo | null> {
    try {
      const response = await this.apiCall('/ccapi/ver120/deviceinformation');
      return response;
    } catch (error) {
      console.error('Failed to get camera info:', error);
      return null;
    }
  }

  /**
   * Get camera status
   */
  async getCameraStatus(): Promise<any> {
    try {
      const response = await this.apiCall('/ccapi/ver120/devicestatus');
      return response;
    } catch (error) {
      console.error('Failed to get camera status:', error);
      return null;
    }
  }

  /**
   * Configure auto transfer settings
   */
  setTransferSettings(settings: Partial<TransferSettings>): void {
    this.transferSettings = { ...this.transferSettings, ...settings };
    this.emit('transferSettingsChanged', this.transferSettings);
    
    if (settings.autoTransfer && !this.polling) {
      this.startPolling();
    } else if (!settings.autoTransfer && this.polling) {
      this.stopPolling();
    }
  }

  /**
   * Take a photo
   */
  async takePicture(): Promise<boolean> {
    try {
      await this.apiCall('/ccapi/ver120/shooting/control/shutterbutton', 'POST', {
        af: true
      });
      
      // Wait for capture to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (this.transferSettings.autoTransfer) {
        await this.checkForNewImages();
      }
      
      this.emit('pictureTaken');
      return true;
    } catch (error) {
      console.error('Failed to take picture:', error);
      return false;
    }
  }

  /**
   * Get list of images on camera
   */
  async getImageList(): Promise<any[]> {
    try {
      const response = await this.apiCall('/ccapi/ver120/contents/sd/100CANON');
      return response?.url || [];
    } catch (error) {
      console.error('Failed to get image list:', error);
      return [];
    }
  }

  /**
   * Download image from camera
   */
  async downloadImage(imageUrl: string): Promise<Buffer | null> {
    try {
      const fullUrl = `http://${this.cameraIP}:${this.cameraPort}${imageUrl}`;
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Failed to download image:', error);
      return null;
    }
  }

  /**
   * Process and save image
   */
  async processAndSaveImage(imageBuffer: Buffer, filename: string, eventId?: string): Promise<string | null> {
    try {
      const uploadsDir = eventId ? path.join('uploads', eventId) : path.join('uploads', 'camera');
      
      // Ensure directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = path.extname(filename) || '.jpg';
      const uniqueFilename = `${eventId || 'camera'}_${timestamp}_${path.basename(filename, extension)}${extension}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      let processedBuffer: Buffer;

      if (this.transferSettings.quality === 'compressed') {
        // Compress image while maintaining quality
        processedBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
      } else {
        processedBuffer = imageBuffer;
      }

      // Save file
      fs.writeFileSync(filePath, processedBuffer);
      
      this.emit('imageProcessed', {
        filename: uniqueFilename,
        path: filePath,
        eventId,
        size: processedBuffer.length
      });

      return filePath;
    } catch (error) {
      console.error('Failed to process and save image:', error);
      return null;
    }
  }

  /**
   * Delete image from camera
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      await this.apiCall(imageUrl, 'DELETE');
      return true;
    } catch (error) {
      console.error('Failed to delete image from camera:', error);
      return false;
    }
  }

  /**
   * Start polling for new images
   */
  private startPolling(): void {
    if (this.polling) return;
    
    this.polling = true;
    this.pollForNewImages();
    console.log('Started polling for new images');
  }

  /**
   * Stop polling for new images
   */
  private stopPolling(): void {
    this.polling = false;
    console.log('Stopped polling for new images');
  }

  /**
   * Poll for new images
   */
  private async pollForNewImages(): Promise<void> {
    if (!this.polling || !this.connected) return;

    try {
      await this.checkForNewImages();
    } catch (error) {
      console.error('Error during polling:', error);
    }

    // Continue polling every 5 seconds
    setTimeout(() => this.pollForNewImages(), 5000);
  }

  /**
   * Check for new images and transfer them
   */
  private async checkForNewImages(): Promise<void> {
    try {
      const images = await this.getImageList();
      const newImages = images.slice(this.lastImageIndex);

      for (const imageInfo of newImages) {
        if (imageInfo.url) {
          await this.transferImage(imageInfo);
        }
      }

      this.lastImageIndex = images.length;
    } catch (error) {
      console.error('Failed to check for new images:', error);
    }
  }

  /**
   * Transfer a single image
   */
  private async transferImage(imageInfo: any): Promise<void> {
    try {
      console.log(`Transferring image: ${imageInfo.name}`);
      
      const imageBuffer = await this.downloadImage(imageInfo.url);
      if (!imageBuffer) {
        throw new Error('Failed to download image');
      }

      const savedPath = await this.processAndSaveImage(
        imageBuffer, 
        imageInfo.name, 
        this.transferSettings.eventId
      );

      if (savedPath && this.transferSettings.deleteAfterTransfer) {
        await this.deleteImage(imageInfo.url);
        console.log(`Deleted image from camera: ${imageInfo.name}`);
      }

      this.emit('imageTransferred', {
        name: imageInfo.name,
        savedPath,
        size: imageBuffer.length,
        eventId: this.transferSettings.eventId
      });

    } catch (error) {
      console.error(`Failed to transfer image ${imageInfo.name}:`, error);
      this.emit('transferError', { imageInfo, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Make API call to camera
   */
  private async apiCall(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    if (!this.cameraIP) {
      throw new Error('Camera not connected');
    }

    const url = `http://${this.cameraIP}:${this.cameraPort}${endpoint}`;
    
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.headers.get('content-type')?.includes('application/json') 
      ? await response.json() 
      : await response.text();
  }

  /**
   * Check if camera is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current transfer settings
   */
  getTransferSettings(): TransferSettings {
    return { ...this.transferSettings };
  }
}

// Export singleton instance
export const cameraService = new CanonCameraService();