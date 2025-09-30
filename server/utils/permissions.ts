/**
 * Centralized Permission Management
 * 
 * This file ensures consistent permission assignments across the application.
 * All permission arrays should be defined here to prevent mismatches.
 */

export const ADMIN_PERMISSIONS = {
  owner: [
    'events', 
    'bookings', 
    'packages', 
    'photos', 
    'contacts', 
    'users', 
    'users_manage', 
    'qr_codes', 
    'storage'
  ],
  admin: [
    'events', 
    'bookings', 
    'packages', 
    'photos', 
    'contacts', 
    'users_view', 
    'qr_codes', 
    'storage'
  ],
  moderator: [
    'events', 
    'bookings', 
    'photos', 
    'contacts'
  ],
  qr_share: [
    'events_view', 
    'qr_codes'
  ]
} as const;

export type AdminRole = keyof typeof ADMIN_PERMISSIONS;

/**
 * Get permissions for a specific admin role
 */
export function getAdminPermissions(role: AdminRole): string[] {
  return [...ADMIN_PERMISSIONS[role]];
}

/**
 * Validate if permissions are valid for a role
 */
export function validatePermissions(role: AdminRole, permissions: string[]): { 
  valid: boolean; 
  invalidPermissions: string[] 
} {
  const validPermissions = getAdminPermissions(role);
  const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
  
  return {
    valid: invalidPermissions.length === 0,
    invalidPermissions
  };
}

/**
 * Get owner permissions (used for admin email assignments)
 */
export function getOwnerPermissions(): string[] {
  return getAdminPermissions('owner');
}

/**
 * Check if a permission is valid for a role
 */
export function hasPermissionForRole(role: AdminRole, permission: string): boolean {
  return (ADMIN_PERMISSIONS[role] as readonly string[]).includes(permission);
}
