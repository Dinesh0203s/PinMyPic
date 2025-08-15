import { MongoClient, GridFSBucket, Db } from 'mongodb';
import { getOptimizedMongoClientOptions } from './database-optimizations';

export class MongoDBService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private gridFS: GridFSBucket | null = null;
  private connectionString: string;

  constructor() {
    // Initialize connection string (will be set during connect())
    this.connectionString = '';
  }

  private initializeConnectionString() {
    // Use the provided MongoDB Atlas connection string
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinmypic';
    const isLocal = this.connectionString.includes('localhost');
    console.log('MongoDB URI initialized:', isLocal ? 'Using local database' : 'Using remote database');
  }

  async connect(): Promise<void> {
    try {
      if (!this.client) {
        // Initialize connection string with current environment variables
        this.initializeConnectionString();
        
        this.client = new MongoClient(this.connectionString, getOptimizedMongoClientOptions());
        await this.client.connect();
        
        // Test the connection
        await this.client.db('admin').command({ ping: 1 });
        
        // Use pinmypic database for the new MongoDB setup
        this.db = this.client.db('pinmypic');
        
        // Initialize GridFS bucket for file storage
        this.gridFS = new GridFSBucket(this.db, { bucketName: 'photos' });
      }
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      // Reset connection state
      this.client = null;
      this.db = null;
      this.gridFS = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.gridFS = null;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected');
    }
    return this.db;
  }

  getGridFS(): GridFSBucket {
    if (!this.gridFS) {
      throw new Error('GridFS not initialized');
    }
    return this.gridFS;
  }

  getClient(): MongoClient | null {
    return this.client;
  }

  async ensureConnection(): Promise<void> {
    if (!this.client || !this.db || !this.gridFS) {
      await this.connect();
    }
  }
}

export const mongoService = new MongoDBService();