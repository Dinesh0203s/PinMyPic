/**
 * Optimized REST API endpoints for admin dashboard
 * Demonstrates how to further improve your existing REST implementation
 */

import { Express } from 'express';

// 1. Batch endpoint for multiple admin resources
export function createAdminBatchEndpoint(app: Express) {
  app.get('/api/admin/dashboard', async (req, res) => {
    try {
      // Single endpoint that returns all dashboard data
      const [stats, storage, bookings, messages, packages] = await Promise.all([
        getStats(),
        getStorageStats(), 
        getBookings(),
        getMessages(),
        getPackages()
      ]);

      res.json({
        stats,
        storage,
        bookings,
        messages,
        packages,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });
}

// 2. Optimized stats endpoint with field selection
export function createOptimizedStatsEndpoint(app: Express) {
  app.get('/api/admin/stats', async (req, res) => {
    const { fields } = req.query;
    
    try {
      const stats = await getStats();
      
      // Allow clients to request only needed fields
      if (fields) {
        const requestedFields = fields.split(',');
        const filteredStats = {};
        requestedFields.forEach(field => {
          if (stats[field] !== undefined) {
            filteredStats[field] = stats[field];
          }
        });
        return res.json(filteredStats);
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });
}

// 3. Conditional requests with ETags
export function createConditionalEndpoint(app: Express) {
  app.get('/api/admin/events', async (req, res) => {
    try {
      const events = await getEvents();
      const etag = `"${events.length}-${events[0]?.updatedAt || '0'}"`;
      
      // Check if client has current version
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      res.set({
        'ETag': etag,
        'Cache-Control': 'private, max-age=60'
      });
      
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });
}
