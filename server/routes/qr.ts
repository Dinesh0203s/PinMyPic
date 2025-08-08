import { Router } from 'express';
import QRCode from 'qrcode';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();

// Generate QR code for event access
router.post('/generate-qr', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { eventId, url } = req.body;

    if (!eventId || !url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event ID and URL are required' 
      });
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

    res.json({
      success: true,
      qrCodeDataUrl,
      url,
      eventId
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

export default router;