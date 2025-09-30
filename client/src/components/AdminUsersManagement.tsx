import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, UserCheck, UserX, Edit3, Trash2, Plus, Mail, Calendar, Activity, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminPermissions } from '@/utils/adminUtils';
import type { User } from '@shared/types';

interface AdminUsersManagementProps {
  currentUser: User;
}

export function AdminUsersManagement({ currentUser }: AdminUsersManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'custom'>('admin');
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const { toast } = useToast();
  const { currentUser: firebaseUser, refreshUserData } = useAuth();

  const isOwner = currentUser.adminRole === 'owner';
  const isAdmin = currentUser.isAdmin && (currentUser.adminRole === 'owner' || currentUser.adminRole === 'admin');

  const allPermissions = [
    { value: 'events', label: 'Manage Events', description: 'Create, edit, and delete events' },
    { value: 'events_view', label: 'View Events', description: 'View events (read-only)' },
    { value: 'bookings', label: 'Manage Bookings', description: 'View and manage all bookings' },
    { value: 'packages', label: 'Manage Packages', description: 'Create and edit service packages' },
    { value: 'photos', label: 'Manage Photos', description: 'Upload and manage event photos' },
    { value: 'contacts', label: 'Manage Messages', description: 'View and respond to contact messages' },
    { value: 'qr_codes', label: 'Manage QR Codes', description: 'Create and manage QR codes for events' },
    { value: 'users', label: 'View Users', description: 'View user information' },
    { value: 'users_manage', label: 'Manage Users', description: 'Promote/demote users and manage roles' }
  ];

  useEffect(() => {
    fetchUsers();
    fetchAdminUsers();
  }, []);

  // Auto-populate permissions when role changes
  useEffect(() => {
    if (selectedRole === 'custom') {
      // Custom role - don't auto-populate, let user choose
      return;
    }
    
    // Auto-populate permissions for predefined roles
    const defaultPermissions = getDefaultPermissions(selectedRole);
    setCustomPermissions(defaultPermissions);
  }, [selectedRole]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!firebaseUser) return {};
    try {
      const token = await firebaseUser.getIdToken();
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Error getting auth token:', error);
      return {};
    }
  };

  const fetchUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/users', { headers });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error('Failed to fetch users:', response.status);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch users. Please check your permissions.",
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/users/admins', { headers });
      if (response.ok) {
        const data = await response.json();
        setAdminUsers(data);
      } else {
        console.error('Failed to fetch admin users:', response.status);
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  };

  const handlePromoteUser = async (userId: string, adminRole: 'admin' | 'moderator' | 'custom', customPermissions: string[] = []) => {
    // Validate custom role has permissions
    if (adminRole === 'custom' && customPermissions.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one permission for the custom role.",
      });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/users/${userId}/promote`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          isAdmin: true, 
          adminRole: adminRole === 'custom' ? 'admin' : adminRole, // Map custom to admin for backend
          adminPermissions: customPermissions.length > 0 ? customPermissions : getDefaultPermissions(adminRole)
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `User promoted to ${adminRole} successfully`,
        });
        fetchUsers();
        fetchAdminUsers();
        setPromoteDialogOpen(false);
        
        // Always refresh user data to update authentication context
        await refreshUserData();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to promote user');
      }
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error)?.message || "Failed to promote user",
      });
    }
  };

  const handleDemoteUser = async (userId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/users/${userId}/promote`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          isAdmin: false, 
          adminRole: undefined,
          adminPermissions: []
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "User demoted successfully",
        });
        fetchUsers();
        fetchAdminUsers();
        
        // Always refresh user data to update authentication context
        await refreshUserData();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to demote user');
      }
    } catch (error) {
      console.error('Error demoting user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error)?.message || "Failed to demote user",
      });
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: 'PATCH',
        headers,
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "User deactivated successfully",
        });
        fetchUsers();
        fetchAdminUsers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error)?.message || "Failed to deactivate user",
      });
    }
  };

  const getDefaultPermissions = (role: 'admin' | 'moderator' | 'custom'): string[] => {
    if (role === 'admin') {
      return ['events', 'bookings', 'packages', 'photos', 'contacts', 'users_view'];
    } else if (role === 'moderator') {
      return ['events', 'bookings', 'photos', 'contacts'];
    } else if (role === 'custom') {
      return []; // Custom role starts with no permissions - user must select them
    }
    return [];
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-500';
      case 'admin': return 'bg-blue-500';
      case 'moderator': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAdminUsers = adminUsers.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts and admin privileges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm"
            />
          </div>

          <Tabs defaultValue="all-users" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all-users" className="text-xs sm:text-sm">
                <span className="hidden sm:inline">All Users</span>
                <span className="sm:hidden">All</span>
                <span className="ml-1">({users.length})</span>
              </TabsTrigger>
              <TabsTrigger value="admin-users" className="text-xs sm:text-sm">
                <span className="hidden sm:inline">Admin Users</span>
                <span className="sm:hidden">Admins</span>
                <span className="ml-1">({adminUsers.length})</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all-users" className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        {isOwner && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm">
                                {user.displayName?.[0] || user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div>{user.displayName || 'No Name'}</div>
                                <div className="text-xs text-gray-500">{user.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.isAdmin ? (
                              <Badge className={getRoleBadgeColor(user.adminRole)}>
                                <Shield className="w-3 h-3 mr-1" />
                                {user.adminRole || 'admin'}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">User</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.isActive !== false ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <Activity className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                <UserX className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(user.createdAt).toLocaleDateString('en-GB')}
                            </div>
                          </TableCell>
                          {isOwner && (
                            <TableCell>
                              <div className="flex gap-2">
                                {/* Show owner badge for owner account */}
                                {user.email === 'dond2674@gmail.com' ? (
                                  <Badge className="bg-purple-500 text-white">
                                    <Crown className="w-3 h-3 mr-1" />
                                    Owner (Protected)
                                  </Badge>
                                ) : (
                                  <>
                                    {!user.isAdmin && user.email !== currentUser.email && (
                                      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedUser(user)}
                                          >
                                            <UserCheck className="w-4 h-4 mr-1" />
                                            Promote
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="mx-4 sm:mx-auto max-w-2xl">
                                          <DialogHeader>
                                            <DialogTitle>Promote User</DialogTitle>
                                            <DialogDescription>
                                              {selectedUser ? `Select the admin role and permissions for ${selectedUser.email}` : 'Select the admin role and permissions for the user'}
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="space-y-6">
                                            <div>
                                              <Label className="text-base font-medium mb-4 block">Select Role</Label>
                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <Button
                                                  onClick={() => setSelectedRole('admin')}
                                                  variant={selectedRole === 'admin' ? 'default' : 'outline'}
                                                  className="flex flex-col items-center gap-2 h-20"
                                                >
                                                  <Shield className="w-6 h-6" />
                                                  <span>Admin</span>
                                                </Button>
                                                <Button
                                                  onClick={() => setSelectedRole('moderator')}
                                                  variant={selectedRole === 'moderator' ? 'default' : 'outline'}
                                                  className="flex flex-col items-center gap-2 h-20"
                                                >
                                                  <UserCheck className="w-6 h-6" />
                                                  <span>Moderator</span>
                                                </Button>
                                                <Button
                                                  onClick={() => setSelectedRole('custom')}
                                                  variant={selectedRole === 'custom' ? 'default' : 'outline'}
                                                  className="flex flex-col items-center gap-2 h-20"
                                                >
                                                  <Edit3 className="w-6 h-6" />
                                                  <span>Custom</span>
                                                </Button>
                                              </div>
                                            </div>

                                            <div>
                                              <Label className="text-base font-medium mb-4 block">
                                                Customize Permissions
                                                {selectedRole === 'custom' && (
                                                  <span className="text-sm text-amber-600 ml-2">(Select at least one permission)</span>
                                                )}
                                              </Label>
                                              {selectedRole === 'custom' && customPermissions.length === 0 && (
                                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                                  <p className="text-sm text-amber-800">
                                                    <strong>Custom Role:</strong> Please select the specific permissions you want to grant to this user.
                                                  </p>
                                                </div>
                                              )}
                                              <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
                                                {allPermissions.map((permission) => (
                                                  <div key={permission.value} className="flex items-start space-x-3">
                                                    <Checkbox
                                                      id={permission.value}
                                                      checked={customPermissions.includes(permission.value)}
                                                      onCheckedChange={(checked) => {
                                                        if (checked) {
                                                          setCustomPermissions([...customPermissions, permission.value]);
                                                        } else {
                                                          setCustomPermissions(customPermissions.filter(p => p !== permission.value));
                                                        }
                                                      }}
                                                    />
                                                    <div className="space-y-1">
                                                      <Label htmlFor={permission.value} className="text-sm font-medium">
                                                        {permission.label}
                                                      </Label>
                                                      <p className="text-xs text-gray-500">{permission.description}</p>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex justify-end gap-3 pt-4 border-t">
                                            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
                                              Cancel
                                            </Button>
                                            <Button 
                                              onClick={() => selectedUser && handlePromoteUser(selectedUser.id, selectedRole, customPermissions)}
                                              disabled={selectedRole === 'custom' && customPermissions.length === 0}
                                            >
                                              Promote User
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    {user.isAdmin && user.adminRole !== 'owner' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDemoteUser(user.id)}
                                        className="text-orange-600 border-orange-600 hover:bg-orange-50"
                                      >
                                        <UserX className="w-4 h-4 mr-1" />
                                        Demote
                                      </Button>
                                    )}
                                    {user.isActive !== false && user.email !== currentUser.email && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeactivateUser(user.id)}
                                        className="text-red-600 border-red-600 hover:bg-red-50"
                                      >
                                        <UserX className="w-4 h-4 mr-1" />
                                        Deactivate
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-lg">
                              {user.displayName?.[0] || user.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">{user.displayName || 'No Name'}</h3>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              <p className="text-xs text-gray-400">ID: {user.id.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </div>

                        {/* Status and Role */}
                        <div className="flex gap-2 flex-wrap">
                          {user.isAdmin ? (
                            <Badge className={getRoleBadgeColor(user.adminRole)}>
                              <Shield className="w-3 h-3 mr-1" />
                              {user.adminRole || 'admin'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">User</Badge>
                          )}
                          {user.isActive !== false ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Activity className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <UserX className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>

                        {/* Join Date */}
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Joined {new Date(user.createdAt).toLocaleDateString('en-GB')}
                        </div>

                        {/* Actions */}
                        {isOwner && (
                          <div className="border-t pt-3">
                            {user.email === 'dond2674@gmail.com' ? (
                              <Badge className="bg-purple-500 text-white w-full justify-center">
                                <Crown className="w-3 h-3 mr-1" />
                                Owner (Protected)
                              </Badge>
                            ) : (
                              <div className="space-y-2">
                                {!user.isAdmin && user.email !== currentUser.email && (
                                  <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedUser(user)}
                                        className="w-full text-xs"
                                      >
                                        <UserCheck className="w-3 h-3 mr-1" />
                                        Promote to Admin
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="mx-4 sm:mx-auto max-w-2xl">
                                      <DialogHeader>
                                        <DialogTitle>Promote User</DialogTitle>
                                        <DialogDescription>
                                          {selectedUser ? `Select the admin role and permissions for ${selectedUser.email}` : 'Select the admin role and permissions for the user'}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-6">
                                        <div>
                                          <Label className="text-base font-medium mb-4 block">Select Role</Label>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <Button
                                              onClick={() => setSelectedRole('admin')}
                                              variant={selectedRole === 'admin' ? 'default' : 'outline'}
                                              className="flex flex-col items-center gap-2 h-20"
                                            >
                                              <Shield className="w-6 h-6" />
                                              <span>Admin</span>
                                            </Button>
                                            <Button
                                              onClick={() => setSelectedRole('moderator')}
                                              variant={selectedRole === 'moderator' ? 'default' : 'outline'}
                                              className="flex flex-col items-center gap-2 h-20"
                                            >
                                              <UserCheck className="w-6 h-6" />
                                              <span>Moderator</span>
                                            </Button>
                                            <Button
                                              onClick={() => setSelectedRole('custom')}
                                              variant={selectedRole === 'custom' ? 'default' : 'outline'}
                                              className="flex flex-col items-center gap-2 h-20"
                                            >
                                              <Edit3 className="w-6 h-6" />
                                              <span>Custom</span>
                                            </Button>
                                          </div>
                                        </div>

                                        <div>
                                          <Label className="text-base font-medium mb-4 block">
                                            Customize Permissions
                                            {selectedRole === 'custom' && (
                                              <span className="text-sm text-amber-600 ml-2">(Select at least one permission)</span>
                                            )}
                                          </Label>
                                          {selectedRole === 'custom' && customPermissions.length === 0 && (
                                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                              <p className="text-sm text-amber-800">
                                                <strong>Custom Role:</strong> Please select the specific permissions you want to grant to this user.
                                              </p>
                                            </div>
                                          )}
                                          <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
                                            {allPermissions.map((permission) => (
                                              <div key={permission.value} className="flex items-start space-x-3">
                                                <Checkbox
                                                  id={`mobile-${permission.value}`}
                                                  checked={customPermissions.includes(permission.value)}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) {
                                                      setCustomPermissions([...customPermissions, permission.value]);
                                                    } else {
                                                      setCustomPermissions(customPermissions.filter(p => p !== permission.value));
                                                    }
                                                  }}
                                                />
                                                <div className="space-y-1">
                                                  <Label htmlFor={`mobile-${permission.value}`} className="text-sm font-medium">
                                                    {permission.label}
                                                  </Label>
                                                  <p className="text-xs text-gray-500">{permission.description}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-3 pt-4 border-t">
                                        <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
                                          Cancel
                                        </Button>
                                        <Button 
                                          onClick={() => selectedUser && handlePromoteUser(selectedUser.id, selectedRole, customPermissions)}
                                          disabled={selectedRole === 'custom' && customPermissions.length === 0}
                                        >
                                          Promote User
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                <div className="grid grid-cols-1 gap-2">
                                  {user.isAdmin && user.adminRole !== 'owner' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDemoteUser(user.id)}
                                      className="text-orange-600 border-orange-600 hover:bg-orange-50 text-xs"
                                    >
                                      <UserX className="w-3 h-3 mr-1" />
                                      Demote
                                    </Button>
                                  )}
                                  {user.isActive !== false && user.email !== currentUser.email && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeactivateUser(user.id)}
                                      className="text-red-600 border-red-600 hover:bg-red-50 text-xs"
                                    >
                                      <UserX className="w-3 h-3 mr-1" />
                                      Deactivate
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="admin-users" className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Since</TableHead>
                        {isOwner && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdminUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm">
                                {user.displayName?.[0] || user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div>{user.displayName || 'No Name'}</div>
                                <div className="text-xs text-gray-500">{user.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(user.adminRole)}>
                              <Shield className="w-3 h-3 mr-1" />
                              {user.adminRole || 'admin'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.adminPermissions?.map((permission) => (
                                <Badge key={permission} variant="secondary" className="text-xs">
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(user.createdAt).toLocaleDateString('en-GB')}
                            </div>
                          </TableCell>
                          {isOwner && (
                            <TableCell>
                              <div className="flex gap-2">
                                {user.adminRole !== 'owner' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDemoteUser(user.id)}
                                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                                  >
                                    <UserX className="w-4 h-4 mr-1" />
                                    Demote
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredAdminUsers.map((user) => (
                  <Card key={user.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-lg">
                              {user.displayName?.[0] || user.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">{user.displayName || 'No Name'}</h3>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              <p className="text-xs text-gray-400">ID: {user.id.substring(0, 8)}...</p>
                            </div>
                          </div>
                          <Badge className={getRoleBadgeColor(user.adminRole)}>
                            <Shield className="w-3 h-3 mr-1" />
                            {user.adminRole || 'admin'}
                          </Badge>
                        </div>

                        {/* Permissions */}
                        <div>
                          <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Permissions
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {getAdminPermissions(user.adminRole).map((permission) => (
                              <Badge key={permission} variant="secondary" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Admin Since */}
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Admin since {new Date(user.createdAt).toLocaleDateString('en-GB')}
                        </div>

                        {/* Actions */}
                        {isOwner && user.adminRole !== 'owner' && (
                          <div className="border-t pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDemoteUser(user.id)}
                              className="text-orange-600 border-orange-600 hover:bg-orange-50 w-full text-xs"
                            >
                              <UserX className="w-3 h-3 mr-1" />
                              Demote from Admin
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}