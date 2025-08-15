/**
 * Database performance optimizations for production
 */

import { MongoClient, Db, Collection } from 'mongodb';

// Connection pooling optimization
export function getOptimizedMongoClientOptions() {
  return {
    // Connection pool settings
    maxPoolSize: 50,        // Maximum number of connections
    minPoolSize: 5,         // Minimum number of connections
    maxIdleTimeMS: 30000,   // Close connections after 30s of inactivity
    
    // Connection timeout settings
    serverSelectionTimeoutMS: 10000,  // How long to try selecting a server
    connectTimeoutMS: 10000,          // How long to wait for initial connection
    socketTimeoutMS: 45000,           // How long to wait for socket operations
    
    // Replica set settings
    readPreference: 'secondaryPreferred', // Read from secondary if available
    readConcern: { level: 'majority' },   // Ensure read consistency
    writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
    
    // Compression
    compressors: ['zstd', 'snappy', 'zlib'], // Enable compression
    
    // Monitoring
    monitorCommands: process.env.NODE_ENV === 'development',
    
    // Retry settings
    retryWrites: true,
    retryReads: true
  };
}

// Database indexing for optimal query performance
export async function createOptimizedIndexes(db: Db) {
  console.log('Creating optimized database indexes...');
  
  try {
    const collections = {
      users: db.collection('users'),
      events: db.collection('events'),
      photos: db.collection('photos'),
      bookings: db.collection('bookings'),
      contacts: db.collection('contacts')
    };

    // Users collection indexes
    await collections.users.createIndex({ firebaseUid: 1 }, { unique: true, background: true });
    await collections.users.createIndex({ email: 1 }, { unique: true, background: true });
    await collections.users.createIndex({ isAdmin: 1, isActive: 1 }, { background: true });
    await collections.users.createIndex({ createdAt: -1 }, { background: true });

    // Events collection indexes
    await collections.events.createIndex({ eventDate: -1 }, { background: true });
    await collections.events.createIndex({ isPrivate: 1, isHidden: 1 }, { background: true });
    await collections.events.createIndex({ category: 1 }, { background: true });
    await collections.events.createIndex({ 
      title: 'text', 
      description: 'text', 
      location: 'text' 
    }, { background: true });
    await collections.events.createIndex({ createdAt: -1 }, { background: true });

    // Photos collection indexes (critical for performance)
    await collections.photos.createIndex({ eventId: 1 }, { background: true });
    await collections.photos.createIndex({ eventId: 1, isProcessed: 1 }, { background: true });
    await collections.photos.createIndex({ uploadedAt: -1 }, { background: true });
    await collections.photos.createIndex({ 'faceData.embedding': 1 }, { background: true, sparse: true });
    await collections.photos.createIndex({ tags: 1 }, { background: true, sparse: true });

    // Bookings collection indexes
    await collections.bookings.createIndex({ userId: 1 }, { background: true, sparse: true });
    await collections.bookings.createIndex({ email: 1 }, { background: true });
    await collections.bookings.createIndex({ eventDate: 1, eventTime: 1 }, { background: true });
    await collections.bookings.createIndex({ status: 1 }, { background: true });
    await collections.bookings.createIndex({ createdAt: -1 }, { background: true });

    // Contacts collection indexes
    await collections.contacts.createIndex({ email: 1 }, { background: true });
    await collections.contacts.createIndex({ eventType: 1 }, { background: true });
    await collections.contacts.createIndex({ createdAt: -1 }, { background: true });

    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Failed to create database indexes:', error);
    // Don't throw error - indexes are optimization, not requirement
  }
}

// Query optimization utilities
export class QueryOptimizer {
  static buildEfficientQuery(filters: any, options: any = {}) {
    const query: any = {};
    const sort: any = {};
    const projection: any = {};
    
    // Convert string filters to efficient MongoDB queries
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && value.length > 0) {
          // Text search for string fields
          if (['title', 'description', 'location', 'name'].includes(key)) {
            query[key] = { $regex: value, $options: 'i' };
          } else {
            query[key] = value;
          }
        } else {
          query[key] = value;
        }
      }
    });
    
    // Optimize sorting
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      sort[options.sortBy] = sortOrder;
    } else {
      // Default sort by creation date (most recent first)
      sort.createdAt = -1;
    }
    
    // Optimize projection (only return needed fields)
    if (options.fields) {
      options.fields.forEach((field: string) => {
        projection[field] = 1;
      });
    }
    
    return { query, sort, projection };
  }

  static buildPaginationPipeline(page: number, limit: number, totalCount: boolean = false) {
    const pipeline: any[] = [];
    
    if (totalCount) {
      // Add facet stage to get both data and count
      pipeline.push({
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      });
    } else {
      // Simple pagination
      pipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: limit }
      );
    }
    
    return pipeline;
  }
}

// Connection pooling monitor
export function monitorConnectionPool(client: MongoClient) {
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      const stats = client.db().admin().serverStatus();
      stats.then((status: any) => {
        const connections = status.connections;
        console.log(`DB Connections - Current: ${connections.current}, Available: ${connections.available}`);
        
        // Alert if connection pool is getting full
        if (connections.current > connections.available * 0.8) {
          console.warn('⚠️  Database connection pool is nearing capacity');
        }
      }).catch(() => {
        // Ignore monitoring errors
      });
    }, 60000); // Check every minute
  }
}

// Aggregation pipeline optimizations
export class AggregationOptimizer {
  static optimizePhotosByEvent(eventId: string, page: number = 1, limit: number = 20) {
    return [
      // Match early to reduce dataset
      { $match: { eventId: eventId, isProcessed: true } },
      
      // Project only needed fields early
      { 
        $project: {
          filename: 1,
          url: 1,
          thumbnailUrl: 1,
          uploadedAt: 1,
          faceData: 1,
          tags: 1
        }
      },
      
      // Sort by upload date (index exists)
      { $sort: { uploadedAt: -1 } },
      
      // Pagination
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];
  }

  static optimizeEventStats() {
    return [
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          publicEvents: {
            $sum: { $cond: [{ $eq: ['$isPrivate', false] }, 1, 0] }
          },
          recentEvents: {
            $sum: {
              $cond: [
                { $gte: ['$eventDate', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ];
  }
}