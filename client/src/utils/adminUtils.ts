import { User } from '@shared/types';

export const hasAdminDashboardAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  // Special check for owner email as fallback
  if (user.email === 'dond2674@gmail.com') {
    return true;
  }
  
  // Check if user has admin privileges
  return user.isAdmin === true && (
    user.adminRole === 'owner' || 
    user.adminRole === 'admin' || 
    user.adminRole === 'moderator' ||
    user.adminRole === 'qr_share'
  );
};

export const getAdminRoleDisplayName = (adminRole?: string): string => {
  switch (adminRole) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrator';
    case 'moderator':
      return 'Moderator';
    case 'qr_share':
      return 'QR Share';
    default:
      return 'User';
  }
};

export const getAdminPermissions = (adminRole?: string): string[] => {
  switch (adminRole) {
    case 'owner':
      return ['events', 'bookings', 'packages', 'photos', 'contacts', 'users', 'users_manage', 'qr_codes', 'storage', 'camera'];
    case 'admin':
      return ['events', 'bookings', 'packages', 'photos', 'contacts', 'users_view', 'qr_codes', 'storage', 'camera'];
    case 'moderator':
      return ['events', 'bookings', 'photos', 'contacts', 'camera'];
    case 'qr_share':
      return ['events_view', 'qr_codes'];
    default:
      return [];
  }
};

// Check if user has specific permission
export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user || !user.isAdmin) return false;
  
  // Owner has all permissions
  if (user.adminRole === 'owner') return true;
  
  // Check user's specific permissions
  const userPermissions = user.adminPermissions || getAdminPermissions(user.adminRole);
  
  // Allow events_view permission to also grant events permission for QR Share users
  if (permission === 'events' && user.adminRole === 'qr_share' && userPermissions.includes('events_view')) {
    return true;
  }
  
  return userPermissions.includes(permission);
};

// Get available tabs based on user permissions
export const getAvailableTabs = (user: User | null): { value: string; label: string; permission: string }[] => {
  const allTabs = [
    { value: 'events', label: 'Events', permission: 'events' },
    { value: 'bookings', label: 'Bookings', permission: 'bookings' },
    { value: 'packages', label: 'Packages', permission: 'packages' },
    { value: 'messages', label: 'Messages', permission: 'contacts' },
    { value: 'users', label: 'Users', permission: 'users' },
    { value: 'qr', label: 'QR Codes', permission: 'qr_codes' },
    { value: 'storage', label: 'Storage', permission: 'storage' },
  ];

  return allTabs.filter(tab => hasPermission(user, tab.permission));
};