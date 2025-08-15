import { Router } from 'express';
import { authenticateUser, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { folderMonitorService } from '../folder-monitor-service';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * Start monitoring a folder for new images
 */
router.post('/start', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { folderPath, eventId } = req.body;
    const userId = req.user!.userData!.id;

    if (!folderPath || !eventId) {
      return res.status(400).json({ error: 'Folder path and event ID are required' });
    }

    // Validate that folder path exists and is accessible
    if (!fs.existsSync(folderPath)) {
      return res.status(400).json({ error: 'Folder path does not exist or is not accessible' });
    }

    // Check if it's actually a directory
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path must be a directory' });
    }

    const result = await folderMonitorService.startMonitoring(userId, eventId, folderPath);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        folderPath: path.resolve(folderPath),
        eventId
      });
    } else {
      res.status(400).json({ error: result.message });
    }

  } catch (error) {
    console.error('Error starting folder monitor:', error);
    res.status(500).json({ error: 'Failed to start folder monitoring' });
  }
});

/**
 * Stop monitoring a folder
 */
router.post('/stop', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { folderPath } = req.body;
    const userId = req.user!.userData!.id;

    const result = await folderMonitorService.stopMonitoring(userId, folderPath);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({ error: result.message });
    }

  } catch (error) {
    console.error('Error stopping folder monitor:', error);
    res.status(500).json({ error: 'Failed to stop folder monitoring' });
  }
});

/**
 * Get active folder monitors for the user
 */
router.get('/active', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userData!.id;
    const monitors = folderMonitorService.getActiveMonitors(userId);

    res.json({
      success: true,
      monitors: monitors.map(monitor => ({
        folderPath: monitor.folderPath,
        eventId: monitor.eventId,
        createdAt: monitor.createdAt,
        updatedAt: monitor.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error getting active monitors:', error);
    res.status(500).json({ error: 'Failed to get active monitors' });
  }
});

/**
 * Browse folders for selection
 */
router.post('/browse', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    let { currentPath = process.cwd() } = req.body;
    
    // Security: Prevent directory traversal attacks
    currentPath = path.resolve(currentPath);
    
    // Read directory contents
    const items = fs.readdirSync(currentPath, { withFileTypes: true })
      .filter(item => {
        // Only show directories and skip hidden folders
        return item.isDirectory() && !item.name.startsWith('.');
      })
      .map(item => ({
        name: item.name,
        type: 'directory',
        fullPath: path.join(currentPath, item.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Add parent directory option if not at root
    const parentPath = path.dirname(currentPath);
    if (parentPath !== currentPath) {
      items.unshift({
        name: '..',
        type: 'parent',
        fullPath: parentPath
      });
    }

    res.json({
      success: true,
      currentPath,
      items
    });

  } catch (error) {
    console.error('Error browsing folders:', error);
    res.status(500).json({ error: 'Failed to browse folders' });
  }
});

/**
 * Validate folder accessibility
 */
router.post('/validate', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { folderPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    // Check if path exists
    if (!fs.existsSync(folderPath)) {
      return res.json({
        valid: false,
        message: 'Path does not exist'
      });
    }

    // Check if it's a directory
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      return res.json({
        valid: false,
        message: 'Path is not a directory'
      });
    }

    // Check if it's readable
    try {
      fs.accessSync(folderPath, fs.constants.R_OK);
    } catch (error) {
      return res.json({
        valid: false,
        message: 'Directory is not readable'
      });
    }

    // Count existing images in folder
    const files = fs.readdirSync(folderPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    const imageCount = files.filter(file => 
      imageExtensions.includes(path.extname(file).toLowerCase())
    ).length;

    res.json({
      valid: true,
      message: 'Folder is valid for monitoring',
      folderPath: path.resolve(folderPath),
      imageCount
    });

  } catch (error) {
    console.error('Error validating folder:', error);
    res.json({
      valid: false,
      message: 'Error accessing folder'
    });
  }
});

/**
 * Validate folder path
 */
router.post('/validate', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { folderPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({ 
        valid: false,
        message: 'Folder path is required' 
      });
    }

    // Check if path exists and is a directory
    try {
      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        return res.json({ 
          valid: false,
          message: 'Path is not a directory' 
        });
      }

      // Check if directory is readable
      fs.accessSync(folderPath, fs.constants.R_OK);

      res.json({ 
        valid: true,
        message: 'Folder is valid and accessible' 
      });

    } catch (error) {
      res.json({ 
        valid: false,
        message: 'Folder does not exist or is not accessible' 
      });
    }

  } catch (error) {
    console.error('Error validating folder:', error);
    res.status(500).json({ 
      valid: false,
      message: 'Failed to validate folder' 
    });
  }
});

export default router;