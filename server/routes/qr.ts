import { Router } from 'express';
import QRCode from 'qrcode';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { mongoStorage } from '../mongo-storage';

const router = Router();

// Generate and save QR code for event access
router.post('/generate-qr', authenticateUser, requireAdmin, async (req: any, res) => {
  try {
    const { eventId, url, expirationHours, maxUsage } = req.body;

    if (!eventId || !url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event ID and URL are required' 
      });
    }

    // Get event details
    const event = await mongoStorage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Calculate expiration time
    let expiresAt: string | null = null;
    if (expirationHours !== null && expirationHours !== undefined && expirationHours !== 0) {
      const now = new Date();
      now.setHours(now.getHours() + parseInt(expirationHours.toString()));
      expiresAt = now.toISOString();
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Save QR code to database
    const qrCodeData = {
      eventId,
      eventTitle: event.title,
      qrCodeDataUrl,
      accessUrl: url,
      expiresAt,
      isActive: true,
      usageCount: 0,
      maxUsage: maxUsage ? parseInt(maxUsage.toString()) : undefined,
      createdBy: req.user?.uid || 'admin',
    };

    const savedQRCode = await mongoStorage.createQRCode(qrCodeData);

    res.json({
      success: true,
      qrCode: savedQRCode,
      message: 'QR code created successfully'
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

// Get all QR codes
router.get('/', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const qrCodes = await mongoStorage.getQRCodes();
    res.json(qrCodes);
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QR codes'
    });
  }
});

// Update QR code
router.patch('/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedQRCode = await mongoStorage.updateQRCode(id, updates);
    
    if (!updatedQRCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    res.json({
      success: true,
      qrCode: updatedQRCode
    });
  } catch (error) {
    console.error('Error updating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update QR code'
    });
  }
});

// Delete QR code
router.delete('/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await mongoStorage.deleteQRCode(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    res.json({
      success: true,
      message: 'QR code deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete QR code'
    });
  }
});

export default router;