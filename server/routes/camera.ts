import { Router } from 'express';
import { cameraService } from '../canon-camera-service.js';
import { authenticateUser, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * Get camera connection status
 */
router.get('/status', authenticateUser, (req: AuthenticatedRequest, res) => {
  try {
    const status = cameraService.getConnectionStatus();
    
    res.json({
      connected: status.connected,
      type: status.type,
      ip: status.ip,
      port: status.port,
      transferSettings: status.transferSettings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get camera status:', error);
    res.status(500).json({ error: 'Failed to get camera status' });
  }
});

/**
 * Test camera connection without actually connecting
 */
router.post('/test-connection', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { ip, port = 8080 } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required for connection test' });
    }
    
    // Test basic network connectivity
    try {
      const response = await fetch(`http://${ip}:${port}/ccapi/ver120/deviceinformation`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        const deviceInfo = await response.json();
        res.json({
          success: true,
          message: `Connection test successful to ${ip}:${port}`,
          deviceInfo,
          reachable: true
        });
      } else {
        res.json({
          success: false,
          message: `Camera at ${ip}:${port} is reachable but returned HTTP ${response.status}`,
          reachable: true,
          httpStatus: response.status
        });
      }
    } catch (error: any) {
      let errorMessage = 'Connection test failed';
      let reachable = false;
      
      if (error.name === 'TimeoutError') {
        errorMessage = `Connection timeout to ${ip}:${port} - camera may be offline or on different network`;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = `Connection refused to ${ip}:${port} - CCAPI service may not be running`;
        reachable = true;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = `Network timeout to ${ip}:${port} - check network connectivity`;
      } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_NODATA') {
        errorMessage = `IP address ${ip} not found on network`;
      }
      
      res.json({
        success: false,
        message: errorMessage,
        reachable,
        error: error.code || error.name,
        details: error.message
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: 'Failed to test camera connection' });
  }
});

/**
 * Connect to camera (wireless or USB)
 */
router.post('/connect', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { ip, port = 8080, type = 'wireless' } = req.body;
    
    let connected = false;
    
    if (type === 'usb' || !ip) {
      // Try USB connection first
      connected = await cameraService.connectUSB();
      
      if (!connected && ip) {
        // Fallback to wireless if USB fails and IP is provided
        connected = await cameraService.connect(ip, port);
      }
    } else {
      // Try wireless connection
      connected = await cameraService.connect(ip, port);
    }
    
    if (connected) {
      const info = await cameraService.getCameraInfo();
      const status = cameraService.getConnectionStatus();
      res.json({
        success: true,
        message: `Connected to camera via ${status.type}`,
        camera: info,
        connectionType: status.type
      });
    } else {
      res.status(400).json({ 
        error: type === 'usb' ? 'Failed to connect via USB. Make sure camera is connected and CCAPI is enabled.' 
                               : 'Failed to connect to camera. Check IP address and network connection.' 
      });
    }
  } catch (error) {
    console.error('Failed to connect to camera:', error);
    res.status(500).json({ error: 'Failed to connect to camera' });
  }
});

/**
 * Connect to camera via USB
 */
router.post('/connect-usb', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const connected = await cameraService.connectUSB();
    
    if (connected) {
      const info = await cameraService.getCameraInfo();
      const status = cameraService.getConnectionStatus();
      res.json({
        success: true,
        message: 'Connected to camera via USB',
        camera: info,
        connectionType: 'usb'
      });
    } else {
      res.status(400).json({ 
        error: 'Failed to connect via USB. Make sure camera is connected via USB cable and CCAPI is enabled on the camera.' 
      });
    }
  } catch (error) {
    console.error('Failed to connect via USB:', error);
    res.status(500).json({ error: 'Failed to connect to camera via USB' });
  }
});

/**
 * Disconnect from camera
 */
router.post('/disconnect', authenticateUser, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    cameraService.disconnect();
    res.json({
      success: true,
      message: 'Disconnected from camera'
    });
  } catch (error) {
    console.error('Failed to disconnect from camera:', error);
    res.status(500).json({ error: 'Failed to disconnect from camera' });
  }
});

/**
 * Get camera information
 */
router.get('/info', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (!cameraService.isConnected()) {
      return res.status(400).json({ error: 'Camera not connected' });
    }

    const info = await cameraService.getCameraInfo();
    const status = await cameraService.getCameraStatus();
    
    res.json({
      info,
      status
    });
  } catch (error) {
    console.error('Failed to get camera info:', error);
    res.status(500).json({ error: 'Failed to get camera information' });
  }
});

/**
 * Take a picture
 */
router.post('/capture', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (!cameraService.isConnected()) {
      return res.status(400).json({ error: 'Camera not connected' });
    }

    const success = await cameraService.takePicture();
    
    if (success) {
      res.json({
        success: true,
        message: 'Picture taken successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to take picture' });
    }
  } catch (error) {
    console.error('Failed to take picture:', error);
    res.status(500).json({ error: 'Failed to take picture' });
  }
});

/**
 * Configure auto transfer settings
 */
router.post('/transfer-settings', authenticateUser, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { autoTransfer, eventId, quality, deleteAfterTransfer } = req.body;
    
    const settings: any = {};
    if (typeof autoTransfer === 'boolean') settings.autoTransfer = autoTransfer;
    if (eventId) settings.eventId = eventId;
    if (quality) settings.quality = quality;
    if (typeof deleteAfterTransfer === 'boolean') settings.deleteAfterTransfer = deleteAfterTransfer;
    
    cameraService.setTransferSettings(settings);
    
    res.json({
      success: true,
      message: 'Transfer settings updated',
      settings: cameraService.getTransferSettings()
    });
  } catch (error) {
    console.error('Failed to update transfer settings:', error);
    res.status(500).json({ error: 'Failed to update transfer settings' });
  }
});

/**
 * Get images on camera
 */
router.get('/images', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (!cameraService.isConnected()) {
      return res.status(400).json({ error: 'Camera not connected' });
    }

    const images = await cameraService.getImageList();
    res.json(images);
  } catch (error) {
    console.error('Failed to get camera images:', error);
    res.status(500).json({ error: 'Failed to get camera images' });
  }
});

/**
 * Download specific image from camera
 */
router.post('/download/:imageUrl(*)', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (!cameraService.isConnected()) {
      return res.status(400).json({ error: 'Camera not connected' });
    }

    const { imageUrl } = req.params;
    const { eventId } = req.body;
    
    const imageBuffer = await cameraService.downloadImage(`/${imageUrl}`);
    
    if (imageBuffer) {
      const filename = imageUrl.split('/').pop() || 'image.jpg';
      const savedPath = await cameraService.processAndSaveImage(imageBuffer, filename, eventId);
      
      res.json({
        success: true,
        message: 'Image downloaded successfully',
        savedPath,
        filename
      });
    } else {
      res.status(500).json({ error: 'Failed to download image' });
    }
  } catch (error) {
    console.error('Failed to download image:', error);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

/**
 * Delete image from camera
 */
router.delete('/images/:imageUrl(*)', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!cameraService.isConnected()) {
      return res.status(400).json({ error: 'Camera not connected' });
    }

    const { imageUrl } = req.params;
    const success = await cameraService.deleteImage(`/${imageUrl}`);
    
    if (success) {
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to delete image' });
    }
  } catch (error) {
    console.error('Failed to delete image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;