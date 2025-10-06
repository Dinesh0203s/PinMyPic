import { ObjectId, Collection, GridFSBucket } from 'mongodb';
import { mongoService } from './mongodb';
import { 
  type User, 
  type InsertUser,
  type Event,
  type InsertEvent,
  type Booking,
  type InsertBooking,
  type ContactMessage,
  type InsertContactMessage,
  type Photo,
  type InsertPhoto,
  type Package,
  type InsertPackage,
  type QRCode,
  type InsertQRCode
} from "@shared/types";
import { IStorage } from './storage';

export class MongoDBStorage implements IStorage {
  private async ensureConnection() {
    await mongoService.ensureConnection();
  }

  private async getCollection(name: string): Promise<Collection> {
    await this.ensureConnection();
    return mongoService.getDb().collection(name);
  }

  private generateId(): string {
    return new ObjectId().toString();
  }

  private transformDocument(doc: any): any {
    if (!doc) return doc;
    const { _id, ...rest } = doc;
    return { ...rest, id: _id.toString() };
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const collection = await this.getCollection('users');
      const user = await collection.findOne({ _id: new ObjectId(id) });
      if (user) {
        return this.transformDocument(user) as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      const collection = await this.getCollection('users');
      const users = await collection.find({}).sort({ createdAt: 1 }).toArray();
      return users.map(user => this.transformDocument(user)) as User[];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async getAdminUsers(): Promise<User[]> {
    try {
      const collection = await this.getCollection('users');
      const users = await collection.find({ isAdmin: true }).sort({ createdAt: 1 }).toArray();
      return users.map(user => this.transformDocument(user)) as User[];
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    try {
      const collection = await this.getCollection('users');
      const user = await collection.findOne({ firebaseUid });
      if (user) {
        return this.transformDocument(user) as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user by Firebase UID:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const collection = await this.getCollection('users');
      const user = await collection.findOne({ email });
      if (user) {
        return this.transformDocument(user) as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      // Check for existing users to prevent duplicates
      const [existingUserByEmail, existingUserByUid] = await Promise.all([
        this.getUserByEmail(user.email),
        this.getUserByFirebaseUid(user.firebaseUid)
      ]);
      
      if (existingUserByEmail) {
        console.log('User with email already exists, returning existing user');
        return existingUserByEmail;
      }
      
      if (existingUserByUid) {
        console.log('User with Firebase UID already exists, returning existing user');
        return existingUserByUid;
      }

      const collection = await this.getCollection('users');
      const now = new Date().toISOString();
      const userData = {
        ...user,
        createdAt: now,
        updatedAt: now,
      };
      
      const result = await collection.insertOne(userData);
      const newUser: User = {
        id: result.insertedId.toString(),
        ...userData,
      };
      
      console.log('Created new user successfully');
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const collection = await this.getCollection('users');
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatedData },
        { returnDocument: 'after' }
      );
      
      if (result) {
        return this.transformDocument(result) as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection('users');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async updateUserAdminStatus(
    id: string, 
    isAdmin: boolean, 
    adminRole?: 'owner' | 'admin' | 'moderator', 
    permissions?: string[]
  ): Promise<User | undefined> {
    try {
      const updates = {
        isAdmin,
        adminRole,
        adminPermissions: permissions,
        updatedAt: new Date().toISOString(),
      };
      
      return await this.updateUser(id, updates);
    } catch (error) {
      console.error('Error updating user admin status:', error);
      return undefined;
    }
  }

  async deactivateUser(id: string): Promise<boolean> {
    try {
      const result = await this.updateUser(id, { isActive: false });
      return result !== undefined;
    } catch (error) {
      console.error('Error deactivating user:', error);
      return false;
    }
  }

  async findOrCreateUserByEmail(userData: InsertUser): Promise<User> {
    try {
      // First try to find existing user by Firebase UID (most reliable)
      let user = await this.getUserByFirebaseUid(userData.firebaseUid);
      
      if (user) {
        // User exists by Firebase UID, update with latest data
        const updatedUser = await this.updateUser(user.id, {
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          email: userData.email, // Update email if changed
        });
        return updatedUser || user;
      }
      
      // Try to find by email as fallback
      user = await this.getUserByEmail(userData.email);
      
      if (user) {
        // User exists by email but not Firebase UID, update Firebase UID and other data
        const updatedUser = await this.updateUser(user.id, {
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          firebaseUid: userData.firebaseUid, // Link Firebase UID to existing account
        });
        return updatedUser || user;
      } else {
        // No user exists, create new one
        return await this.createUser(userData);
      }
    } catch (error) {
      console.error('Error finding or creating user by email:', error);
      throw error;
    }
  }

  async savePhotoToProfile(userId: string, photoId: string): Promise<{ success: boolean; alreadySaved?: boolean }> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        return { success: false };
      }

      const savedPhotos = user.savedPhotos || [];
      if (savedPhotos.includes(photoId)) {
        return { success: true, alreadySaved: true };
      }

      const collection = await this.getCollection('users');
      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { savedPhotos: [...savedPhotos, photoId], updatedAt: new Date().toISOString() } }
      );

      return { success: result.modifiedCount > 0 };
    } catch (error) {
      console.error('Error saving photo to profile:', error);
      return { success: false };
    }
  }

  async removePhotoFromProfile(userId: string, photoId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        return false;
      }

      const savedPhotos = user.savedPhotos || [];
      const updatedPhotos = savedPhotos.filter(id => id !== photoId);

      const collection = await this.getCollection('users');
      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { savedPhotos: updatedPhotos, updatedAt: new Date().toISOString() } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error removing photo from profile:', error);
      return false;
    }
  }

  async getUserSavedPhotos(userId: string): Promise<Photo[]> {
    try {
      const user = await this.getUser(userId);
      if (!user || !user.savedPhotos) {
        return [];
      }

      const collection = await this.getCollection('photos');
      const photos = await collection.find({
        _id: { $in: user.savedPhotos.map(id => new ObjectId(id)) }
      }).toArray();

      return photos.map(photo => this.transformDocument(photo)) as Photo[];
    } catch (error) {
      console.error('Error getting user saved photos:', error);
      return [];
    }
  }

  // Event methods
  async getEvents(): Promise<Event[]> {
    try {
      const collection = await this.getCollection('events');
      const events = await collection.find({}).sort({ eventDate: 1 }).toArray();
      
      // Update photo counts
      const eventsWithCounts = await Promise.all(
        events.map(async (event) => {
          const photoCount = await this.getEventPhotoCount(event._id.toString());
          const transformed = this.transformDocument(event);
          return {
            ...transformed,
            photoCount
          };
        })
      );

      return eventsWithCounts as Event[];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async getEvent(id: string): Promise<Event | undefined> {
    try {
      const collection = await this.getCollection('events');
      const event = await collection.findOne({ _id: new ObjectId(id) });
      if (event) {
        const photoCount = await this.getEventPhotoCount(id);
        const transformed = this.transformDocument(event);
        return { ...transformed, photoCount } as Event;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting event:', error);
      return undefined;
    }
  }

  async getPublicEvents(): Promise<Event[]> {
    try {
      const collection = await this.getCollection('events');
      const events = await collection.find({ isPrivate: { $ne: true } }).sort({ eventDate: 1 }).toArray();
      
      // Update photo counts
      const eventsWithCounts = await Promise.all(
        events.map(async (event) => {
          const photoCount = await this.getEventPhotoCount(event._id.toString());
          const transformed = this.transformDocument(event);
          return {
            ...transformed,
            photoCount
          };
        })
      );

      return eventsWithCounts as Event[];
    } catch (error) {
      console.error('Error fetching public events:', error);
      return [];
    }
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    try {
      const collection = await this.getCollection('events');
      const now = new Date().toISOString();
      const eventData = {
        ...event,
        photoCount: event.photoCount || 0,
        isPrivate: event.isPrivate || false,
        createdAt: now,
        updatedAt: now,
      };
      
      const result = await collection.insertOne(eventData);
      const newEvent: Event = {
        id: result.insertedId.toString(),
        ...eventData,
      };
      
      return newEvent;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    try {
      const collection = await this.getCollection('events');
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatedData },
        { returnDocument: 'after' }
      );
      
      if (result) {
        const photoCount = await this.getEventPhotoCount(id);
        const transformed = this.transformDocument(result);
        return { ...transformed, photoCount } as Event;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating event:', error);
      return undefined;
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      // First get all photos for this event
      const photos = await this.getEventPhotos(id);
      const photoIds = photos.map(photo => photo.id);
      
      // Remove all event photos from users' saved photos lists
      if (photoIds.length > 0) {
        const usersCollection = await this.getCollection('users');
        
        // Update all users who have any of these photos saved
        for (const photoId of photoIds) {
          await usersCollection.updateMany(
            { savedPhotos: photoId },
            { 
              $pull: { savedPhotos: photoId } as any,
              $set: { updatedAt: new Date().toISOString() }
            }
          );
        }
      }
      
      // Delete all photos for this event
      for (const photo of photos) {
        await this.deletePhoto(photo.id);
      }
      
      // Finally delete the event itself
      const collection = await this.getCollection('events');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      
      if (result.deletedCount > 0) {
        console.log(`Successfully deleted event ${id} and removed ${photoIds.length} photos from all users' saved photos`);
      }
      
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  // Booking methods
  async getBookings(): Promise<Booking[]> {
    try {
      const collection = await this.getCollection('bookings');
      const bookings = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return bookings.map(booking => this.transformDocument(booking)) as Booking[];
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    try {
      const collection = await this.getCollection('bookings');
      const booking = await collection.findOne({ _id: new ObjectId(id) });
      if (booking) {
        return this.transformDocument(booking) as Booking;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting booking:', error);
      return undefined;
    }
  }

  async getUserBookings(userId: string): Promise<Booking[]> {
    try {
      const collection = await this.getCollection('bookings');
      const bookings = await collection.find({ userId }).sort({ createdAt: 1 }).toArray();
      return bookings.map(booking => this.transformDocument(booking)) as Booking[];
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      return [];
    }
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    try {
      const collection = await this.getCollection('bookings');
      const now = new Date().toISOString();
      
      const bookingData = {
        ...booking,
        status: booking.status || 'pending',
        createdAt: now,
        updatedAt: now,
      };
      
      const result = await collection.insertOne(bookingData);
      const newBooking: Booking = {
        id: result.insertedId.toString(),
        ...bookingData,
      };
      
      return newBooking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    try {
      const collection = await this.getCollection('bookings');
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatedData },
        { returnDocument: 'after' }
      );
      
      if (result) {
        return this.transformDocument(result) as Booking;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating booking:', error);
      return undefined;
    }
  }

  async deleteBooking(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection('bookings');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting booking:', error);
      return false;
    }
  }

  // Contact methods
  async getContactMessages(): Promise<ContactMessage[]> {
    try {
      const collection = await this.getCollection('contactMessages');
      const messages = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return messages.map(message => this.transformDocument(message)) as ContactMessage[];
    } catch (error) {
      console.error('Error fetching contact messages:', error);
      return [];
    }
  }

  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    try {
      const collection = await this.getCollection('contactMessages');
      const now = new Date().toISOString();
      const messageData = {
        ...message,
        isRead: message.isRead || false,
        createdAt: now,
      };
      
      const result = await collection.insertOne(messageData);
      const newMessage: ContactMessage = {
        id: result.insertedId.toString(),
        ...messageData,
      };
      
      return newMessage;
    } catch (error) {
      console.error('Error creating contact message:', error);
      throw error;
    }
  }

  async markMessageAsRead(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection('contactMessages');
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isRead: true } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  async deleteContactMessage(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection('contactMessages');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting contact message:', error);
      return false;
    }
  }

  async clearAllContactMessages(): Promise<boolean> {
    try {
      const collection = await this.getCollection('contactMessages');
      await collection.deleteMany({});
      return true;
    } catch (error) {
      console.error('Error clearing all contact messages:', error);
      return false;
    }
  }

  // Package methods
  async getPackages(): Promise<Package[]> {
    try {
      const collection = await this.getCollection('packages');
      const packages = await collection.find({ isActive: true }).sort({ price: 1 }).toArray();
      return packages.map(pkg => this.transformDocument(pkg)) as Package[];
    } catch (error) {
      console.error('Error fetching packages:', error);
      return [];
    }
  }

  async getAllPackages(): Promise<Package[]> {
    try {
      const collection = await this.getCollection('packages');
      const packages = await collection.find({}).sort({ price: 1 }).toArray();
      return packages.map(pkg => this.transformDocument(pkg)) as Package[];
    } catch (error) {
      console.error('Error fetching all packages:', error);
      return [];
    }
  }

  async getActivePackages(): Promise<Package[]> {
    return this.getPackages();
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    try {
      const collection = await this.getCollection('packages');
      const now = new Date().toISOString();
      const packageData = {
        ...pkg,
        isPopular: pkg.isPopular || false,
        isActive: pkg.isActive !== false, // Default to true unless explicitly set to false
        createdAt: now,
        updatedAt: now,
      };
      
      const result = await collection.insertOne(packageData);
      const newPackage: Package = {
        id: result.insertedId.toString(),
        ...packageData,
      };
      
      return newPackage;
    } catch (error) {
      console.error('Error creating package:', error);
      throw error;
    }
  }

  async updatePackage(id: string, updates: Partial<InsertPackage>): Promise<Package | undefined> {
    try {
      const collection = await this.getCollection('packages');
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatedData },
        { returnDocument: 'after' }
      );
      
      if (result) {
        return this.transformDocument(result) as Package;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating package:', error);
      return undefined;
    }
  }

  async deletePackage(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection('packages');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting package:', error);
      return false;
    }
  }

  // Photo methods
  async getPhoto(id: string): Promise<Photo | undefined> {
    try {
      const collection = await this.getCollection('photos');
      const photo = await collection.findOne({ _id: new ObjectId(id) });
      if (photo) {
        return this.transformDocument(photo) as Photo;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting photo:', error);
      return undefined;
    }
  }

  async getEventPhotos(eventId: string): Promise<Photo[]> {
    try {
      const collection = await this.getCollection('photos');
      const photos = await collection.find({ eventId }).sort({ uploadedAt: 1 }).toArray();
      return photos.map(photo => this.transformDocument(photo)) as Photo[];
    } catch (error) {
      console.error('Error fetching event photos:', error);
      return [];
    }
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    try {
      const collection = await this.getCollection('photos');
      const now = new Date().toISOString();
      const photoData = {
        ...photo,
        isProcessed: photo.isProcessed || false,
        uploadedAt: now,
      };
      
      const result = await collection.insertOne(photoData);
      const newPhoto: Photo = {
        id: result.insertedId.toString(),
        ...photoData,
      };
      
      // Update event photo count
      await this.updateEventPhotoCount(photo.eventId);
      
      return newPhoto;
    } catch (error) {
      console.error('Error creating photo:', error);
      throw error;
    }
  }

  async updatePhoto(id: string, updates: Partial<InsertPhoto>): Promise<Photo | undefined> {
    try {
      const collection = await this.getCollection('photos');
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: 'after' }
      );
      
      if (result) {
        return this.transformDocument(result) as Photo;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating photo:', error);
      return undefined;
    }
  }

  async deletePhoto(id: string): Promise<boolean> {
    try {
      const photo = await this.getPhoto(id);
      if (!photo) return false;

      // Delete image files from GridFS before deleting database record
      if (photo.url && photo.url.startsWith('/api/images/')) {
        const fileId = photo.url.replace('/api/images/', '');
        try {
          // Delete main file
          await this.deleteImageFromGridFS(fileId);
          
          // Also delete thumbnail if it exists and is different from main file
          if (photo.thumbnailId && photo.thumbnailId !== fileId) {
            await this.deleteImageFromGridFS(photo.thumbnailId);
          }
        } catch (fileError) {
          console.error('Error deleting GridFS file:', fileError);
          // Continue with database deletion even if file deletion fails
        }
      }

      // Remove photo from all users' saved photos lists
      await this.removePhotoFromAllUsers(id);

      // Delete photo record from database
      const collection = await this.getCollection('photos');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      
      if (result.deletedCount > 0) {
        // Update event photo count
        await this.updateEventPhotoCount(photo.eventId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting photo:', error);
      return false;
    }
  }

  // QR Code methods
  async getQRCodes(): Promise<QRCode[]> {
    try {
      const collection = await this.getCollection('qrcodes');
      const qrCodes = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return qrCodes.map(qrCode => this.transformDocument(qrCode)) as QRCode[];
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      return [];
    }
  }

  async getQRCode(id: string): Promise<QRCode | undefined> {
    try {
      const collection = await this.getCollection('qrcodes');
      const qrCode = await collection.findOne({ _id: new ObjectId(id) });
      if (qrCode) {
        return this.transformDocument(qrCode) as QRCode;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting QR code:', error);
      return undefined;
    }
  }

  async getActiveQRCodes(): Promise<QRCode[]> {
    try {
      const collection = await this.getCollection('qrcodes');
      const qrCodes = await collection.find({ isActive: true }).sort({ createdAt: -1 }).toArray();
      return qrCodes.map(qrCode => this.transformDocument(qrCode)) as QRCode[];
    } catch (error) {
      console.error('Error fetching active QR codes:', error);
      return [];
    }
  }

  async getEventQRCodes(eventId: string): Promise<QRCode[]> {
    try {
      const collection = await this.getCollection('qrcodes');
      const qrCodes = await collection.find({ eventId }).sort({ createdAt: -1 }).toArray();
      return qrCodes.map(qrCode => this.transformDocument(qrCode)) as QRCode[];
    } catch (error) {
      console.error('Error fetching event QR codes:', error);
      return [];
    }
  }

  async createQRCode(qrCode: InsertQRCode): Promise<QRCode> {
    try {
      const collection = await this.getCollection('qrcodes');
      const now = new Date().toISOString();
      const qrCodeData = {
        ...qrCode,
        isActive: qrCode.isActive !== false, // Default to true unless explicitly set to false
        usageCount: qrCode.usageCount || 0,
        createdAt: now,
      };
      
      const result = await collection.insertOne(qrCodeData);
      const newQRCode: QRCode = {
        id: result.insertedId.toString(),
        ...qrCodeData,
      };
      
      return newQRCode;
    } catch (error) {
      console.error('Error creating QR code:', error);
      throw error;
    }
  }

  async updateQRCode(id: string, updates: Partial<InsertQRCode>): Promise<QRCode | undefined> {
    try {
      const collection = await this.getCollection('qrcodes');
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: 'after' }
      );
      
      if (result) {
        return this.transformDocument(result) as QRCode;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating QR code:', error);
      return undefined;
    }
  }

  async deleteQRCode(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection('qrcodes');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting QR code:', error);
      return false;
    }
  }

  async incrementQRCodeUsage(id: string): Promise<QRCode | undefined> {
    try {
      const collection = await this.getCollection('qrcodes');
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $inc: { usageCount: 1 },
          $set: { lastUsedAt: new Date().toISOString() }
        },
        { returnDocument: 'after' }
      );
      
      if (result) {
        return this.transformDocument(result) as QRCode;
      }
      return undefined;
    } catch (error) {
      console.error('Error incrementing QR code usage:', error);
      return undefined;
    }
  }

  // Helper methods
  private async getEventPhotoCount(eventId: string): Promise<number> {
    try {
      const collection = await this.getCollection('photos');
      const count = await collection.countDocuments({ eventId });
      return count;
    } catch (error) {
      console.error('Error getting event photo count:', error);
      return 0;
    }
  }

  private async updateEventPhotoCount(eventId: string): Promise<void> {
    try {
      const photoCount = await this.getEventPhotoCount(eventId);
      const collection = await this.getCollection('events');
      await collection.updateOne(
        { _id: new ObjectId(eventId) },
        { $set: { photoCount } }
      );
    } catch (error) {
      console.error('Error updating event photo count:', error);
    }
  }

  // GridFS image methods
  async deleteImageFromGridFS(fileId: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const db = mongoService.getDb();
      const bucket = new GridFSBucket(db, { bucketName: 'photos' });

      const objectId = new ObjectId(fileId);
      
      // Check if file exists before deleting
      const files = await bucket.find({ _id: objectId }).toArray();
      
      if (files.length === 0) {
        return false;
      }

      // Delete the file and all its chunks
      await bucket.delete(objectId);
      
      // Wait a moment for the deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify deletion by checking if file still exists
      const remainingFiles = await bucket.find({ _id: objectId }).toArray();
      
      if (remainingFiles.length === 0) {
        return true;
      } else {
        // Try manual chunk cleanup as fallback
        return await this.manualChunkCleanup(fileId, objectId, db);
      }
    } catch (error) {
      console.error(`Error deleting image from GridFS: ${fileId}`, error);
      return false;
    }
  }

  // Manual chunk cleanup as fallback
  private async manualChunkCleanup(fileId: string, objectId: ObjectId, db: any): Promise<boolean> {
    try {
      // Delete from files collection
      const filesCollection = db.collection('photos.files');
      const filesResult = await filesCollection.deleteOne({ _id: objectId });
      
      // Delete from chunks collection
      const chunksCollection = db.collection('photos.chunks');
      const chunksResult = await chunksCollection.deleteMany({ files_id: objectId });
      
      // Verify cleanup
      const remainingFiles = await filesCollection.find({ _id: objectId }).toArray();
      const remainingChunks = await chunksCollection.find({ files_id: objectId }).toArray();
      
      if (remainingFiles.length === 0 && remainingChunks.length === 0) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(`Manual chunk cleanup failed for ${fileId}:`, error);
      return false;
    }
  }

  // Remove photo from all users' saved photos lists
  async removePhotoFromAllUsers(photoId: string): Promise<void> {
    try {
      const usersCollection = await this.getCollection('users');
      
      await usersCollection.updateMany(
        { savedPhotos: photoId },
        { 
          $pull: { savedPhotos: photoId } as any,
          $set: { updatedAt: new Date().toISOString() }
        }
      );
    } catch (error) {
      console.error(`Error removing photo from users:`, error);
      throw error;
    }
  }

  // Method to check chunks for a specific file
  async getFileChunks(fileId: string): Promise<{ file: any; chunks: any[]; chunkCount: number }> {
    try {
      await this.ensureConnection();
      const db = mongoService.getDb();
      
      const filesCollection = db.collection('photos.files');
      const chunksCollection = db.collection('photos.chunks');
      
      const objectId = new ObjectId(fileId);
      
      // Get file info
      const file = await filesCollection.findOne({ _id: objectId });
      if (!file) {
        return { file: null, chunks: [], chunkCount: 0 };
      }
      
      // Get chunks for this file
      const chunks = await chunksCollection.find({ files_id: objectId }).toArray();
      
      return {
        file: {
          _id: file._id,
          filename: file.filename,
          length: file.length,
          chunkSize: file.chunkSize,
          uploadDate: file.uploadDate,
          contentType: file.contentType
        },
        chunks: chunks.map(chunk => ({
          _id: chunk._id,
          files_id: chunk.files_id,
          n: chunk.n,
          data: chunk.data ? `Buffer(${chunk.data.length})` : 'empty'
        })),
        chunkCount: chunks.length
      };
    } catch (error) {
      console.error(`Error checking file chunks:`, error);
      return { file: null, chunks: [], chunkCount: 0 };
    }
  }

  // Method to check GridFS collections status
  async getGridFSStatus(): Promise<{ files: any[]; chunks: any[]; totalFiles: number; totalChunks: number; totalSize: number }> {
    try {
      await this.ensureConnection();
      const db = mongoService.getDb();
      
      const filesCollection = db.collection('photos.files');
      const chunksCollection = db.collection('photos.chunks');
      
      // Get all files
      const files = await filesCollection.find({}).toArray();
      
      // Get all chunks
      const chunks = await chunksCollection.find({}).toArray();
      
      // Calculate total size
      const totalSize = files.reduce((sum, file) => sum + (file.length || 0), 0);
      
      return {
        files: files.map(file => ({
          _id: file._id,
          filename: file.filename,
          length: file.length,
          chunkSize: file.chunkSize,
          uploadDate: file.uploadDate,
          contentType: file.contentType
        })),
        chunks: chunks.map(chunk => ({
          _id: chunk._id,
          files_id: chunk.files_id,
          n: chunk.n,
          data: chunk.data ? `Buffer(${chunk.data.length})` : 'empty'
        })),
        totalFiles: files.length,
        totalChunks: chunks.length,
        totalSize: totalSize
      };
    } catch (error) {
      console.error(`Error checking GridFS status:`, error);
      return { files: [], chunks: [], totalFiles: 0, totalChunks: 0, totalSize: 0 };
    }
  }

  // Utility method to check for orphaned chunks and clean them up
  async cleanupOrphanedChunks(): Promise<{ orphanedFiles: number; orphanedChunks: number; cleanedFiles: number; cleanedChunks: number }> {
    try {
      await this.ensureConnection();
      const db = mongoService.getDb();
      
      const filesCollection = db.collection('photos.files');
      const chunksCollection = db.collection('photos.chunks');
      
      // Find all files in GridFS
      const allFiles = await filesCollection.find({}).toArray();
      
      // Find all chunks
      const allChunks = await chunksCollection.find({}).toArray();
      
      let orphanedFiles = 0;
      let orphanedChunks = 0;
      let cleanedFiles = 0;
      let cleanedChunks = 0;
      
      // Check for files without corresponding chunks
      for (const file of allFiles) {
        const fileChunks = await chunksCollection.find({ files_id: file._id }).toArray();
        if (fileChunks.length === 0) {
          await filesCollection.deleteOne({ _id: file._id });
          orphanedFiles++;
          cleanedFiles++;
        }
      }
      
      // Check for chunks without corresponding files
      for (const chunk of allChunks) {
        const file = await filesCollection.findOne({ _id: chunk.files_id });
        if (!file) {
          await chunksCollection.deleteOne({ _id: chunk._id });
          orphanedChunks++;
          cleanedChunks++;
        }
      }
      
      return { orphanedFiles, orphanedChunks, cleanedFiles, cleanedChunks };
    } catch (error) {
      console.error(`Error during orphaned chunks cleanup:`, error);
      return { orphanedFiles: 0, orphanedChunks: 0, cleanedFiles: 0, cleanedChunks: 0 };
    }
  }

  async getImageFromGridFS(fileId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      await this.ensureConnection();
      const db = mongoService.getDb();
      const bucket = new GridFSBucket(db, { bucketName: 'photos' });

      // Convert string fileId to ObjectId
      const objectId = new ObjectId(fileId);
      
      // Check if file exists
      const files = await bucket.find({ _id: objectId }).toArray();
      if (files.length === 0) {
        console.log(`Image not found in GridFS: ${fileId}`);
        return null;
      }

      const fileInfo = files[0];
      const downloadStream = bucket.openDownloadStream(objectId);
      
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        
        downloadStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        downloadStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            contentType: fileInfo.contentType || 'image/jpeg'
          });
        });
        
        downloadStream.on('error', (error) => {
          console.error(`Error downloading image from GridFS: ${fileId}`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`Error getting image from GridFS: ${fileId}`, error);
      return null;
    }
  }
}

export const mongoStorage = new MongoDBStorage();