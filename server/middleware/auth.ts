import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../firebase-admin';
import { storage } from '../storage';
import { getOwnerPermissions } from '../utils/permissions';

export interface AuthenticatedRequest extends Request {
  user?: {
    firebaseUid: string;
    email: string;
    userData?: any;
  };
}

export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Development bypass: Only allow in specific development scenarios with explicit flag
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_BYPASS === 'true') {
      console.log('Development mode: bypassing full Firebase verification (EXPLICIT BYPASS ENABLED)');
      
      // Special bypass for admin test tokens on WhatsApp endpoints only
      if (token === 'test-token-admin' && req.path.startsWith('/api/whatsapp')) {
        console.log('Development WhatsApp admin bypass activated');
        req.user = {
          firebaseUid: 'dev-admin-uid',
          email: 'admin@pinmypic.com',
          userData: {
            id: 'dev-admin-uid',
            firebaseUid: 'dev-admin-uid',
            email: 'admin@pinmypic.com',
            displayName: 'Development Admin',
            isAdmin: true,
            adminRole: 'owner',
            adminPermissions: getOwnerPermissions(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
        return next();
      }
      
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          
          if (payload.uid && payload.email) {
            req.user = {
              firebaseUid: payload.uid,
              email: payload.email,
            };

            // Get or create user data
            let userData = await storage.getUserByFirebaseUid(payload.uid);
            if (!userData) {
              userData = await storage.getUserByEmail(payload.email);
            }
            
            if (!userData) {
              // Create user in database for development
              userData = {
                id: payload.uid,
                firebaseUid: payload.uid,
                email: payload.email,
                displayName: payload.name || 'User',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // Set admin status for owner
                isAdmin: payload.email === process.env.ADMIN_EMAIL,
                adminRole: payload.email === process.env.ADMIN_EMAIL ? 'owner' : undefined,
                adminPermissions: payload.email === process.env.ADMIN_EMAIL ? getOwnerPermissions() : undefined
              };
            } else if (payload.email === process.env.ADMIN_EMAIL && !userData.isAdmin) {
              // Ensure owner always has admin status
              userData.isAdmin = true;
              userData.adminRole = 'owner';
              userData.adminPermissions = getOwnerPermissions();
            }
            
            req.user.userData = userData;
            return next();
          }
        }
      } catch (devError) {
        console.log('Development token parsing failed, trying Firebase verification');
      }
    }
    
    // Production path: Use Firebase verification
    try {
      const decodedToken = await verifyFirebaseToken(token);
      
      req.user = {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
      };

      // Get user data from database
      let userData = await storage.getUserByFirebaseUid(decodedToken.uid);
      if (!userData) {
        userData = await storage.getUserByEmail(decodedToken.email || '');
      }
      
      // Ensure owner always has admin status
      if (userData && decodedToken.email === 'dond2674@gmail.com' && !userData.isAdmin) {
        userData.isAdmin = true;
        userData.adminRole = 'owner';
        userData.adminPermissions = getOwnerPermissions();
      }
      
      if (userData) {
        req.user.userData = userData;
      }

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check if user has admin privileges in the database
  const userData = req.user?.userData;
  const isAdmin = userData?.isAdmin === true;
  
  if (!isAdmin) {
    console.log('Admin access denied for user');
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Only allow the owner to perform certain actions
  const isOwner = req.user?.email === 'dond2674@gmail.com' && req.user?.userData?.adminRole === 'owner';
  if (!isOwner) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

// Granular permission middleware
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userData = req.user?.userData;
    
    if (!userData || !userData.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Owner has all permissions
    if (userData.adminRole === 'owner') {
      return next();
    }
    
    // Check specific permission
    const userPermissions = userData.adminPermissions || getAdminPermissions(userData.adminRole);
    
    // Special case for QR Share users with events_view permission
    if (permission === 'events' && userData.adminRole === 'qr_share' && userPermissions.includes('events_view')) {
      return next();
    }
    
    if (!userPermissions.includes(permission)) {
      console.log(`Permission denied: User lacks permission '${permission}'`);
      return res.status(403).json({ error: `Permission '${permission}' required` });
    }
    
    next();
  };
}

// Helper function to get admin permissions (matching client-side logic)
function getAdminPermissions(adminRole?: string): string[] {
  switch (adminRole) {
    case 'owner':
      return ['events', 'bookings', 'packages', 'photos', 'contacts', 'users', 'users_manage', 'qr_codes', 'storage'];
    case 'admin':
      return ['events', 'bookings', 'packages', 'photos', 'contacts', 'users_view', 'qr_codes', 'storage'];
    case 'moderator':
      return ['events', 'bookings', 'photos', 'contacts'];
    case 'qr_share':
      return ['events_view', 'qr_codes'];
    default:
      return [];
  }
}

// Permission validation functions
export function validatePermissions(role: string, permissions: string[]): { valid: boolean; invalidPermissions: string[] } {
  const validPermissions = getAdminPermissions(role);
  const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
  
  return {
    valid: invalidPermissions.length === 0,
    invalidPermissions
  };
}

export function hasPermission(userData: any, permission: string): boolean {
  if (!userData || !userData.isAdmin) return false;
  
  // Owner has all permissions
  if (userData.adminRole === 'owner') return true;
  
  // Check user's specific permissions
  const userPermissions = userData.adminPermissions || getAdminPermissions(userData.adminRole);
  
  // Special case for QR Share users with events_view permission
  if (permission === 'events' && userData.adminRole === 'qr_share' && userPermissions.includes('events_view')) {
    return true;
  }
  
  return userPermissions.includes(permission);
}