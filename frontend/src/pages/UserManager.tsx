import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppUserStore } from '../store/appUserStore';
import { canAccessUserManager } from '../utils/auth';
import { Users as UsersIcon, UserPlus, X, AlertCircle } from 'lucide-react';
import UserSearch from '../components/users/UserSearch';
import AppUserList from '../components/users/AppUserList';
import AppUserForm from '../components/users/AppUserForm';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import Select from '../components/ui/Select';
import type { AppUser, AppUserRole, AzureAdUser } from '../services/appUserService';

export default function UserManager() {
  const { user: currentUser } = useAuthStore();
  const hasAccess = canAccessUserManager(currentUser);
  const {
    users,
    isLoading,
    error,
    searchResults,
    isSearching,
    showInactive,
    fetchUsers,
    addUser,
    editUser,
    removeUser,
    restoreUser,
    searchUsers,
    clearSearch,
    setShowInactive,
    clearError,
  } = useAppUserStore();

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [selectedAzureUser, setSelectedAzureUser] = useState<AzureAdUser | null>(null);
  const [newUserRole, setNewUserRole] = useState<AppUserRole>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Access Denied
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const handleSelectAzureUser = (user: AzureAdUser) => {
    setSelectedAzureUser(user);
    setLocalError(null);
  };

  const handleAddUser = async () => {
    if (!selectedAzureUser) return;

    setIsSubmitting(true);
    setLocalError(null);

    try {
      const email = selectedAzureUser.mail || selectedAzureUser.userPrincipalName;
      await addUser({
        aadUserId: selectedAzureUser.id,
        email,
        firstName: selectedAzureUser.givenName || selectedAzureUser.displayName.split(' ')[0] || '',
        lastName: selectedAzureUser.surname || selectedAzureUser.displayName.split(' ').slice(1).join(' ') || '',
        displayName: selectedAzureUser.displayName,
        role: newUserRole,
      });

      setSelectedAzureUser(null);
      setNewUserRole('viewer');
      setIsAddingUser(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (data: {
    firstName: string;
    lastName: string;
    displayName: string;
    role: AppUserRole;
  }) => {
    if (!editingUser) return;

    setIsSubmitting(true);
    setLocalError(null);

    try {
      await editUser(editingUser.id, data);
      setEditingUser(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user? They will no longer be able to access the application.')) {
      return;
    }

    try {
      await removeUser(userId);
    } catch (err) {
      // Error is already set in the store
    }
  };

  const handleReactivate = async (userId: string) => {
    try {
      await restoreUser(userId);
    } catch (err) {
      // Error is already set in the store
    }
  };

  const existingEmails = users.map((u) => u.email);
  const displayError = localError || error;

  return (
    <div className="py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            User Manager
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage user access and permissions for MapLedger
          </p>
        </div>
        {!isAddingUser && !editingUser && (
          <button
            onClick={() => setIsAddingUser(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </button>
        )}
      </div>

      {displayError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700 dark:text-red-300">{displayError}</p>
            </div>
            <button
              onClick={() => {
                clearError();
                setLocalError(null);
              }}
              className="ml-3"
            >
              <X className="h-5 w-5 text-red-400 hover:text-red-600" />
            </button>
          </div>
        </div>
      )}

      {isAddingUser && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Add New User
              </h2>
              <button
                onClick={() => {
                  setIsAddingUser(false);
                  setSelectedAzureUser(null);
                  setNewUserRole('viewer');
                  clearSearch();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search for a user in your organization
                </label>
                <UserSearch
                  onSelect={handleSelectAzureUser}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  onSearch={searchUsers}
                  onClear={clearSearch}
                  existingEmails={existingEmails}
                  placeholder="Start typing a name or email..."
                />
              </div>

              {selectedAzureUser && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-lg font-medium text-blue-600 dark:text-blue-300">
                          {(selectedAzureUser.givenName?.[0] || selectedAzureUser.displayName[0]).toUpperCase()}
                          {(selectedAzureUser.surname?.[0] || selectedAzureUser.displayName.split(' ')[1]?.[0] || '').toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {selectedAzureUser.displayName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedAzureUser.mail || selectedAzureUser.userPrincipalName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedAzureUser(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <Select
                      label="Assign Role"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as AppUserRole)}
                    >
                      <option value="viewer">Viewer - Can view data but cannot make changes</option>
                      <option value="admin">Admin - Can view and edit data</option>
                      <option value="super">Super User - Full access including user management</option>
                    </Select>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleAddUser}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Adding...' : 'Add User'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {editingUser && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Edit User
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <AppUserForm
              user={editingUser}
              onSubmit={handleEditUser}
              onCancel={() => setEditingUser(null)}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      )}

      {!isAddingUser && !editingUser && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Show inactive users</span>
              </label>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {users.length} user{users.length !== 1 ? 's' : ''}
            </p>
          </div>

          {isLoading ? (
            <Card>
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading users...</p>
              </div>
            </Card>
          ) : (
            <AppUserList
              users={users}
              currentUserEmail={currentUser?.email}
              onEdit={setEditingUser}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
              showInactive={showInactive}
            />
          )}
        </>
      )}
    </div>
  );
}
