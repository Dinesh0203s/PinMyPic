import { mongoService } from './mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { 
  type User, type Event, type Booking, type Photo, type ContactMessage, type Package, type QRCode,
  InsertUser, InsertEvent, InsertBooking, InsertPhoto, InsertContactMessage, InsertPackage
} from '../shared/types';

export interface IMongoStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getAdminUsers(): Promise<User[]>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  updateUserAdminStatus(id: string, isAdmin: boolean, adminRole?: 'owner' | 'admin' | 'moderator', permissions?: string[]): Promise<User | undefined>;
  deactivateUser(id: string): Promise<boolean>;
  findOrCreateUserByEmail(userData: InsertUser): Promise<User>;
  savePhotoToProfile(userId: string, photoId: string): Promise<{ success: boolean; alreadySaved?: boolean }>;
  removePhotoFromProfile(userId: string, photoId: string): Promise<boolean>;
  getUserSavedPhotos(userId: string): Promise<Photo[]>;
  
  // Event methods
  getEvent(id: string): Promise<Event | undefined>;
  getEvents(): Promise<Event[]>;
  getAllEvents(): Promise<Event[]>;
  getPublicEvents(): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Booking methods
  getBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getUserBookings(userId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<boolean>;
  
  // Package methods
  getPackages(): Promise<Package[]>;
  getAllPackages(): Promise<Package[]>;
  getActivePackages(): Promise<Package[]>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: string, updates: Partial<InsertPackage>): Promise<Package | undefined>;
  deletePackage(id: string): Promise<boolean>;
  
  // Photo methods
  getPhoto(id: string): Promise<Photo | undefined>;
  getEventPhotos(eventId: string): Promise<Photo[]>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, updates: Partial<InsertPhoto>): Promise<Photo | undefined>;
  deletePhoto(id: string): Promise<boolean>;
  
  // Contact message methods
  getContactMessages(): Promise<ContactMessage[]>;
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  markMessageAsRead(id: string): Promise<boolean>;
  deleteContactMessage(id: string): Promise<boolean>;
  clearAllContactMessages(): Promise<boolean>;
  
  // GridFS methods
  uploadImageToGridFS(buffer: Buffer, filename: string, contentType: string): Promise<string>;
  getImageFromGridFS(fileId: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  deleteImageFromGridFS(fileId: string): Promise<boolean>;
  
  // Cascade deletion methods
  removePhotoFromAllUsers(photoId: string): Promise<boolean>;
}

export class MongoStorage implements IMongoStorage {
  
  private transformDocument(doc: any): any {
    if (!doc) return doc;
    
    // Convert MongoDB _id to id and remove _id
    const { _id, ...rest } = doc;
    return {
      id: _id?.toString() || doc.id,
      ...rest
    };
  }

  // GridFS methods
  async uploadImageToGridFS(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    try {
      await mongoService.ensureConnection();
      const gridFS = mongoService.getGridFS();
      
      return new Promise((resolve, reject) => {
        const uploadStream = gridFS.openUploadStream(filename, {
          contentType,
          metadata: { uploadDate: new Date() }
        });
        
        uploadStream.on('finish', () => {
          resolve(uploadStream.id.toString());
        });
        
        uploadStream.on('error', reject);
        uploadStream.end(buffer);
      });
    } catch (error) {
      console.error('Error uploading to GridFS:', error);
      throw error;
    }
  }

  async getImageFromGridFS(fileId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      await mongoService.ensureConnection();
      const gridFS = mongoService.getGridFS();
      const db = mongoService.getDb();
      
      // Get file metadata to extract content type
      const fileDoc = await db.collection('photos.files').findOne({ _id: new ObjectId(fileId) });
      
      const chunks: Buffer[] = [];
      const downloadStream = gridFS.openDownloadStream(new ObjectId(fileId));
      
      return new Promise((resolve, reject) => {
        downloadStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        downloadStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = fileDoc?.contentType || 'image/jpeg';
          resolve({ buffer, contentType });
        });
        
        downloadStream.on('error', () => {
          resolve(null);
        });
      });
    } catch (error) {
      console.error('Error downloading from GridFS:', error);
      return null;
    }
  }

  async deleteImageFromGridFS(fileId: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const gridFS = mongoService.getGridFS();
      await gridFS.delete(new ObjectId(fileId));
      return true;
    } catch (error) {
      console.error('Error deleting from GridFS:', error);
      return false;
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const user = await db.collection('users').findOne({ id });
      return user ? this.transformDocument(user) : undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const user = await db.collection('users').findOne({ firebaseUid });
      return user ? this.transformDocument(user) : undefined;
    } catch (error) {
      console.error('Error getting user by Firebase UID:', error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const newUser = {
        id: `user_${Date.now()}`,
        ...user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        savedPhotos: [],
        isActive: true
      };
      
      await db.collection('users').insertOne(newUser);
      return this.transformDocument(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const updatedUser = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await db.collection('users').findOneAndUpdate(
        { id },
        { $set: updatedUser },
        { returnDocument: 'after' }
      );
      
      return result ? this.transformDocument(result) : undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const users = await db.collection('users')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      
      return users.map(user => this.transformDocument(user));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async getAdminUsers(): Promise<User[]> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const users = await db.collection('users')
        .find({ isAdmin: true })
        .sort({ createdAt: -1 })
        .toArray();
      
      return users.map(user => this.transformDocument(user));
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const user = await db.collection('users').findOne({ email });
      return user ? this.transformDocument(user) : undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const result = await db.collection('users').deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async updateUserAdminStatus(id: string, isAdmin: boolean, adminRole?: 'owner' | 'admin' | 'moderator', permissions?: string[]): Promise<User | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const updates = {
        isAdmin,
        adminRole: adminRole || null,
        permissions: permissions || [],
        updatedAt: new Date().toISOString(),
      };
      
      const result = await db.collection('users').findOneAndUpdate(
        { id },
        { $set: updates },
        { returnDocument: 'after' }
      );
      
      return result ? this.transformDocument(result) : undefined;
    } catch (error) {
      console.error('Error updating user admin status:', error);
      return undefined;
    }
  }

  async deactivateUser(id: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const result = await db.collection('users').findOneAndUpdate(
        { id },
        { $set: { isActive: false, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );
      
      return !!result;
    } catch (error) {
      console.error('Error deactivating user:', error);
      return false;
    }
  }

  async findOrCreateUserByEmail(userData: InsertUser): Promise<User> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      
      // First try to find by Firebase UID if provided
      if (userData.firebaseUid) {
        const existingUser = await db.collection('users').findOne({ firebaseUid: userData.firebaseUid });
        if (existingUser) {
          return this.transformDocument(existingUser);
        }
      }
      
      // Then try to find by email
      const existingUser = await db.collection('users').findOne({ email: userData.email });
      if (existingUser) {
        return this.transformDocument(existingUser);
      }
      
      // Create new user
      return await this.createUser(userData);
    } catch (error) {
      console.error('Error finding or creating user by email:', error);
      throw error;
    }
  }

  async savePhotoToProfile(userId: string, photoId: string): Promise<{ success: boolean; alreadySaved?: boolean }> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      
      // Check if photo is already saved
      const user = await db.collection('users').findOne({ id: userId });
      if (!user) {
        return { success: false };
      }
      
      const savedPhotos = user.savedPhotos || [];
      if (savedPhotos.includes(photoId)) {
        return { success: true, alreadySaved: true };
      }
      
      // Add photo to saved photos
      const result = await db.collection('users').findOneAndUpdate(
        { id: userId },
        { 
          $addToSet: { savedPhotos: photoId },
          $set: { updatedAt: new Date().toISOString() }
        },
        { returnDocument: 'after' }
      );
      
      return { success: !!result };
    } catch (error) {
      console.error('Error saving photo to profile:', error);
      return { success: false };
    }
  }

  async removePhotoFromProfile(userId: string, photoId: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      
      const result = await db.collection('users').findOneAndUpdate(
        { id: userId },
        { 
          $pull: { savedPhotos: photoId } as any,
          $set: { updatedAt: new Date().toISOString() }
        },
        { returnDocument: 'after' }
      );
      
      return !!result;
    } catch (error) {
      console.error('Error removing photo from profile:', error);
      return false;
    }
  }

  async getUserSavedPhotos(userId: string): Promise<Photo[]> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      
      // Get user's saved photo IDs
      const user = await db.collection('users').findOne({ id: userId });
      if (!user || !user.savedPhotos || user.savedPhotos.length === 0) {
        return [];
      }
      
      // Get the actual photo documents
      const photos = await db.collection('photos')
        .find({ id: { $in: user.savedPhotos } })
        .sort({ createdAt: -1 })
        .toArray();
      
      return photos.map(photo => this.transformDocument(photo));
    } catch (error) {
      console.error('Error getting user saved photos:', error);
      return [];
    }
  }

  // Event methods
  async getEvent(id: string): Promise<Event | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const event = await db.collection('events').findOne({ id });
      return event ? this.transformDocument(event) : undefined;
    } catch (error) {
      console.error('Error getting event:', error);
      return undefined;
    }
  }

  async getEvents(): Promise<Event[]> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const events = await db.collection('events')
        .find({})
        .sort({ date: -1 })
        .toArray();
      
      return events.map(event => this.transformDocument(event));
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async getAllEvents(): Promise<Event[]> {
    return this.getEvents();
  }

  async getPublicEvents(): Promise<Event[]> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const events = await db.collection('events')
        .find({ isPrivate: { $ne: true } })
        .sort({ date: -1 })
        .toArray();
      
      return events.map(event => this.transformDocument(event));
    } catch (error) {
      console.error('Error fetching public events:', error);
      return [];
    }
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const newEvent = {
        id: `event_${Date.now()}`,
        ...event,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoCount: 0
      };
      
      await db.collection('events').insertOne(newEvent);
      return this.transformDocument(newEvent);
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const updatedEvent = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await db.collection('events').findOneAndUpdate(
        { id },
        { $set: updatedEvent },
        { returnDocument: 'after' }
      );
      
      return result ? this.transformDocument(result) : undefined;
    } catch (error) {
      console.error('Error updating event:', error);
      return undefined;
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const result = await db.collection('events').deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  // Photo methods
  async getPhoto(id: string): Promise<Photo | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const photo = await db.collection('photos').findOne({ id });
      return photo ? this.transformDocument(photo) : undefined;
    } catch (error) {
      console.error('Error getting photo:', error);
      return undefined;
    }
  }

  async getEventPhotos(eventId: string): Promise<Photo[]> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const photos = await db.collection('photos')
        .find({ eventId })
        .sort({ createdAt: -1 })
        .toArray();
      
      return photos.map(photo => this.transformDocument(photo));
    } catch (error) {
      console.error('Error fetching event photos:', error);
      return [];
    }
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const newPhoto = {
        id: `photo_${Date.now()}`,
        ...photo,
        uploadedAt: new Date().toISOString()
      };
      
      await db.collection('photos').insertOne(newPhoto);
      return this.transformDocument(newPhoto);
    } catch (error) {
      console.error('Error creating photo:', error);
      throw error;
    }
  }

  async updatePhoto(id: string, updates: Partial<InsertPhoto>): Promise<Photo | undefined> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const updatedPhoto = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await db.collection('photos').findOneAndUpdate(
        { id },
        { $set: updatedPhoto },
        { returnDocument: 'after' }
      );
      
      return result ? this.transformDocument(result) : undefined;
    } catch (error) {
      console.error('Error updating photo:', error);
      return undefined;
    }
  }

  async deletePhoto(id: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      const result = await db.collection('photos').deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting photo:', error);
      return false;
    }
  }

  // Booking methods - stub implementations
  async getBookings(): Promise<Booking[]> {
    return [];
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    return undefined;
  }

  async getUserBookings(userId: string): Promise<Booking[]> {
    return [];
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    throw new Error('Not implemented');
  }

  async updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    return undefined;
  }

  async deleteBooking(id: string): Promise<boolean> {
    return false;
  }

  // Package methods - stub implementations
  async getPackages(): Promise<Package[]> {
    return [];
  }

  async getAllPackages(): Promise<Package[]> {
    return [];
  }

  async getActivePackages(): Promise<Package[]> {
    return [];
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    throw new Error('Not implemented');
  }

  async updatePackage(id: string, updates: Partial<InsertPackage>): Promise<Package | undefined> {
    return undefined;
  }

  async deletePackage(id: string): Promise<boolean> {
    return false;
  }

  // Contact message methods - stub implementations
  async getContactMessages(): Promise<ContactMessage[]> {
    return [];
  }

  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    throw new Error('Not implemented');
  }

  async markMessageAsRead(id: string): Promise<boolean> {
    return false;
  }

  async deleteContactMessage(id: string): Promise<boolean> {
    return false;
  }

  async clearAllContactMessages(): Promise<boolean> {
    return false;
  }

  // CASCADE DELETION: Remove photo from all users' saved photos lists
  async removePhotoFromAllUsers(photoId: string): Promise<boolean> {
    try {
      await mongoService.ensureConnection();
      const db = mongoService.getDb();
      
      // Remove the photo ID from all users' savedPhotos arrays
      const result = await db.collection('users').updateMany(
        { savedPhotos: { $in: [photoId] } },
        { 
          $pull: { savedPhotos: photoId } as any,
          $set: { updatedAt: new Date().toISOString() }
        }
      );
      
      console.log(`🗑️ Cascade deletion: Removed photo ${photoId} from ${result.modifiedCount} users' saved lists`);
      return true;
    } catch (error) {
      console.error('Error removing photo from all users:', error);
      return false;
    }
  }
}

export const mongoStorage = new MongoStorage();