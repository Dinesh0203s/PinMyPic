import { mongoStorage } from "./mongo-db-storage";
import { cache } from "./cache";
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

export interface IStorage {
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
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
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

  // Contact methods
  getContactMessages(): Promise<ContactMessage[]>;
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  markMessageAsRead(id: string): Promise<boolean>;
  deleteContactMessage(id: string): Promise<boolean>;
  clearAllContactMessages(): Promise<boolean>;
  
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
  
  // QR Code methods
  getQRCodes(): Promise<QRCode[]>;
  getQRCode(id: string): Promise<QRCode | undefined>;
  getActiveQRCodes(): Promise<QRCode[]>;
  getEventQRCodes(eventId: string): Promise<QRCode[]>;
  createQRCode(qrCode: InsertQRCode): Promise<QRCode>;
  updateQRCode(id: string, updates: Partial<InsertQRCode>): Promise<QRCode | undefined>;
  deleteQRCode(id: string): Promise<boolean>;
  incrementQRCodeUsage(id: string): Promise<QRCode | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return mongoStorage.getUser(id);
  }

  async getUsers(): Promise<User[]> {
    return mongoStorage.getUsers();
  }

  async getAdminUsers(): Promise<User[]> {
    return mongoStorage.getAdminUsers();
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    return mongoStorage.getUserByFirebaseUid(firebaseUid);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return mongoStorage.getUserByEmail(email);
  }

  async createUser(user: InsertUser): Promise<User> {
    return mongoStorage.createUser(user);
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    return mongoStorage.updateUser(id, updates);
  }

  async deleteUser(id: string): Promise<boolean> {
    return mongoStorage.deleteUser(id);
  }

  async updateUserAdminStatus(id: string, isAdmin: boolean, adminRole?: 'owner' | 'admin' | 'moderator', permissions?: string[]): Promise<User | undefined> {
    return mongoStorage.updateUserAdminStatus(id, isAdmin, adminRole, permissions);
  }

  async deactivateUser(id: string): Promise<boolean> {
    return mongoStorage.deactivateUser(id);
  }

  async findOrCreateUserByEmail(userData: InsertUser): Promise<User> {
    return mongoStorage.findOrCreateUserByEmail(userData);
  }

  async savePhotoToProfile(userId: string, photoId: string): Promise<{ success: boolean; alreadySaved?: boolean }> {
    return mongoStorage.savePhotoToProfile(userId, photoId);
  }

  async removePhotoFromProfile(userId: string, photoId: string): Promise<boolean> {
    return mongoStorage.removePhotoFromProfile(userId, photoId);
  }

  async getUserSavedPhotos(userId: string): Promise<Photo[]> {
    return mongoStorage.getUserSavedPhotos(userId);
  }

  // Event methods
  async getEvents(): Promise<Event[]> {
    return mongoStorage.getEvents();
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return mongoStorage.getEvent(id);
  }

  async getPublicEvents(): Promise<Event[]> {
    return mongoStorage.getPublicEvents();
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    return mongoStorage.createEvent(event);
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    return mongoStorage.updateEvent(id, updates);
  }

  async deleteEvent(id: string): Promise<boolean> {
    return mongoStorage.deleteEvent(id);
  }

  // Booking methods
  async getBookings(): Promise<Booking[]> {
    return mongoStorage.getBookings();
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    return mongoStorage.getBooking(id);
  }

  async getUserBookings(userId: string): Promise<Booking[]> {
    return mongoStorage.getUserBookings(userId);
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    return mongoStorage.createBooking(booking);
  }

  async updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    return mongoStorage.updateBooking(id, updates);
  }

  async deleteBooking(id: string): Promise<boolean> {
    return mongoStorage.deleteBooking(id);
  }

  // Contact methods
  async getContactMessages(): Promise<ContactMessage[]> {
    return mongoStorage.getContactMessages();
  }

  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    return mongoStorage.createContactMessage(message);
  }

  async markMessageAsRead(id: string): Promise<boolean> {
    return mongoStorage.markMessageAsRead(id);
  }

  async deleteContactMessage(id: string): Promise<boolean> {
    return mongoStorage.deleteContactMessage(id);
  }

  async clearAllContactMessages(): Promise<boolean> {
    return mongoStorage.clearAllContactMessages();
  }

  // Package methods
  async getPackages(): Promise<Package[]> {
    return mongoStorage.getPackages();
  }

  async getAllPackages(): Promise<Package[]> {
    return mongoStorage.getAllPackages();
  }

  async getActivePackages(): Promise<Package[]> {
    return mongoStorage.getActivePackages();
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    return mongoStorage.createPackage(pkg);
  }

  async updatePackage(id: string, updates: Partial<InsertPackage>): Promise<Package | undefined> {
    return mongoStorage.updatePackage(id, updates);
  }

  async deletePackage(id: string): Promise<boolean> {
    return mongoStorage.deletePackage(id);
  }

  // Photo methods
  async getPhoto(id: string): Promise<Photo | undefined> {
    return mongoStorage.getPhoto(id);
  }

  async getEventPhotos(eventId: string): Promise<Photo[]> {
    return mongoStorage.getEventPhotos(eventId);
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    return mongoStorage.createPhoto(photo);
  }

  async updatePhoto(id: string, updates: Partial<InsertPhoto>): Promise<Photo | undefined> {
    return mongoStorage.updatePhoto(id, updates);
  }

  async deletePhoto(id: string): Promise<boolean> {
    return mongoStorage.deletePhoto(id);
  }

  // QR Code methods
  async getQRCodes(): Promise<QRCode[]> {
    return mongoStorage.getQRCodes();
  }

  async getQRCode(id: string): Promise<QRCode | undefined> {
    return mongoStorage.getQRCode(id);
  }

  async getActiveQRCodes(): Promise<QRCode[]> {
    return mongoStorage.getActiveQRCodes();
  }

  async getEventQRCodes(eventId: string): Promise<QRCode[]> {
    return mongoStorage.getEventQRCodes(eventId);
  }

  async createQRCode(qrCode: InsertQRCode): Promise<QRCode> {
    return mongoStorage.createQRCode(qrCode);
  }

  async updateQRCode(id: string, updates: Partial<InsertQRCode>): Promise<QRCode | undefined> {
    return mongoStorage.updateQRCode(id, updates);
  }

  async deleteQRCode(id: string): Promise<boolean> {
    return mongoStorage.deleteQRCode(id);
  }

  async incrementQRCodeUsage(id: string): Promise<QRCode | undefined> {
    return mongoStorage.incrementQRCodeUsage(id);
  }
}

export const storage = new DatabaseStorage();