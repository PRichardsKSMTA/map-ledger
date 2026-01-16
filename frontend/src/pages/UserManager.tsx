import { useMemo, useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppUserStore } from '../store/appUserStore';
import { Users as UsersIcon, X, AlertCircle } from 'lucide-react';
import UserSearch from '../components/users/UserSearch';
import AppUserList from '../components/users/AppUserList';
import AppUserForm from '../components/users/AppUserForm';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { getCurrentAppUser } from '../services/appUserService';
import type { AppUser, AppUserRole, AzureAdUser } from '../services/appUserService';

export default function UserManager() {
  const { user: currentUser } = useAuthStore();
  const {
    users,
    isLoading,
    error,
    searchResults,
    isSearching,
    fetchUsers,
    addUser,
    editUser,
    removeUser,
    restoreUser,
    searchUsers,
    clearSearch,
    clearError,
  } = useAppUserStore();

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, AppUserRole | undefined>>({});
  const [roleUpdating, setRoleUpdating] = useState<Record<string, boolean | undefined>>({});
  const [monthlyClosingDateOverrides, setMonthlyClosingDateOverrides] = useState<
    Record<string, number | null | undefined>
  >({});
  const [monthlyClosingDateUpdating, setMonthlyClosingDateUpdating] = useState<
    Record<string, boolean | undefined>
  >({});
  const [surveyNotifyOverrides, setSurveyNotifyOverrides] = useState<
    Record<string, boolean | undefined>
  >({});
  const [surveyNotifyUpdating, setSurveyNotifyUpdating] = useState<
    Record<string, boolean | undefined>
  >({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  const [currentAppUserRole, setCurrentAppUserRole] = useState<AppUserRole | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<Record<AppUserRole, string[]>>({
    viewer: ['view_data'],
    admin: ['view_data', 'edit_data', 'manage_coa'],
    super: ['view_data', 'edit_data', 'manage_coa', 'manage_users'],
  });

  const permissionCatalog = [
    {
      id: 'view_data',
      label: 'View data',
      description: 'Access dashboards, reports, and read-only data.',
    },
    {
      id: 'edit_data',
      label: 'Edit data',
      description: 'Create or update mappings, distributions, and configurations.',
    },
    {
      id: 'manage_coa',
      label: 'COA Manager',
      description: 'Access and manage chart of accounts tooling.',
    },
    {
      id: 'manage_users',
      label: 'Manage users',
      description: 'Access user management and role assignments.',
    },
  ];

  const roleSummaries = [
    {
      role: 'Viewer',
      key: 'viewer' as AppUserRole,
      description: 'View data only. No edits or administrative actions.',
    },
    {
      role: 'Admin',
      key: 'admin' as AppUserRole,
      description: 'View and edit data across MapLedger features.',
    },
    {
      role: 'Super User',
      key: 'super' as AppUserRole,
      description: 'Full access, including user management and administrative settings.',
    },
  ];

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    let isMounted = true;
    const loadCurrentUser = async () => {
      try {
        const appUser = await getCurrentAppUser(currentUser?.email);
        if (isMounted) {
          setCurrentAppUserRole(appUser?.role ?? null);
          setIsCheckingAccess(false);
        }
      } catch {
        if (isMounted) {
          setCurrentAppUserRole(null);
          setIsCheckingAccess(false);
        }
      }
    };

    loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.email]);

  const hasAccess = currentAppUserRole === 'super';

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) {
      return users;
    }
    const query = userSearchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const status = user.isActive ? 'active' : 'inactive';
      const monthlyClosingDate = user.monthlyClosingDate?.toString() ?? '';
      const surveyNotify = user.surveyNotify ? 'true' : 'false';
      return (
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        (user.clientName ?? '').toLowerCase().includes(query) ||
        (user.clientScac ?? '').toLowerCase().includes(query) ||
        monthlyClosingDate.includes(query) ||
        surveyNotify.includes(query) ||
        status.includes(query)
      );
    });
  }, [userSearchQuery, users]);

  if (isCheckingAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

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

  const handleAddUser = async (selectedAzureUser: AzureAdUser) => {
    if (isSubmitting) {
      return;
    }

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
        role: 'viewer',
        createdBy: currentUser?.email ?? undefined,
      });
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
      await editUser(editingUser.id, { ...data, updatedBy: currentUser?.email ?? undefined });
      setEditingUser(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (user: AppUser, role: AppUserRole) => {
    if (user.role === role) {
      return;
    }

    setRoleOverrides((prev) => ({ ...prev, [user.id]: role }));
    setRoleUpdating((prev) => ({ ...prev, [user.id]: true }));
    setLocalError(null);

    try {
      await editUser(user.id, { role, updatedBy: currentUser?.email ?? undefined });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setRoleUpdating((prev) => ({ ...prev, [user.id]: false }));
      setRoleOverrides((prev) => {
        const { [user.id]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleMonthlyClosingDateChange = async (user: AppUser, value: number | null) => {
    if (user.monthlyClosingDate === value) {
      return;
    }

    setMonthlyClosingDateOverrides((prev) => ({ ...prev, [user.id]: value }));
    setMonthlyClosingDateUpdating((prev) => ({ ...prev, [user.id]: true }));
    setLocalError(null);

    try {
      await editUser(user.id, {
        monthlyClosingDate: value,
        updatedBy: currentUser?.email ?? undefined,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update monthly closing date');
    } finally {
      setMonthlyClosingDateUpdating((prev) => ({ ...prev, [user.id]: false }));
      setMonthlyClosingDateOverrides((prev) => {
        const { [user.id]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleSurveyNotifyChange = async (user: AppUser, value: boolean) => {
    if (user.surveyNotify === value) {
      return;
    }

    setSurveyNotifyOverrides((prev) => ({ ...prev, [user.id]: value }));
    setSurveyNotifyUpdating((prev) => ({ ...prev, [user.id]: true }));
    setLocalError(null);

    try {
      await editUser(user.id, { surveyNotify: value, updatedBy: currentUser?.email ?? undefined });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update survey notify');
    } finally {
      setSurveyNotifyUpdating((prev) => ({ ...prev, [user.id]: false }));
      setSurveyNotifyOverrides((prev) => {
        const { [user.id]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
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
  const isSuperUser = currentAppUserRole === 'super';

  return (
    <div className="py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Manage Users
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage user access and permissions for MapLedger
          </p>
        </div>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Add users
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search for a user in your organization
          </label>
          <div className="max-w-xl">
            <UserSearch
              onSelect={handleAddUser}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearch={searchUsers}
              onClear={clearSearch}
              existingEmails={existingEmails}
              placeholder="Start typing a name or email..."
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            New users are added with View only permissions. Update roles inline in the table.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Role permissions
            </h2>
            {isSuperUser && (
              <div className="flex items-center space-x-3">
                {isEditingPermissions ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingPermissions(false)}
                      className="text-sm font-medium text-gray-600 hover:text-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPermissions(false)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      Save changes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingPermissions(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    Manage permissions
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {roleSummaries.map((summary) => (
              <div
                key={summary.role}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {summary.role}
                </h3>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {summary.description}
                </p>
                <div className="mt-3 space-y-2">
                  {permissionCatalog.map((permission) => {
                    const isEnabled = rolePermissions[summary.key].includes(permission.id);
                    if (!isEditingPermissions || !isSuperUser) {
                      return isEnabled ? (
                        <div key={permission.id} className="text-xs text-gray-600 dark:text-gray-300">
                          {permission.label}
                        </div>
                      ) : null;
                    }
                    return (
                      <label
                        key={permission.id}
                        className="flex items-start space-x-2 text-xs text-gray-600 dark:text-gray-300"
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setRolePermissions((prev) => {
                              const next = new Set(prev[summary.key]);
                              if (checked) {
                                next.add(permission.id);
                              } else {
                                next.delete(permission.id);
                              }
                              return { ...prev, [summary.key]: Array.from(next) };
                            });
                          }}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{permission.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!isSuperUser && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Only Super Users can adjust role permissions.
            </p>
          )}
          {isSuperUser && isEditingPermissions && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Changes are saved locally for now. Backend permissions storage will be added next.
            </p>
          )}
        </CardContent>
      </Card>

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

      <div className="flex items-center justify-between">
        <div className="max-w-sm w-full">
          <Input
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder="Search users by name, email, role, or status..."
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
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
          users={filteredUsers}
          currentUserEmail={currentUser?.email}
          onEdit={setEditingUser}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          onRoleChange={handleRoleChange}
          onMonthlyClosingDateChange={handleMonthlyClosingDateChange}
          onSurveyNotifyChange={handleSurveyNotifyChange}
          roleOverrides={roleOverrides}
          roleUpdating={roleUpdating}
          monthlyClosingDateOverrides={monthlyClosingDateOverrides}
          monthlyClosingDateUpdating={monthlyClosingDateUpdating}
          surveyNotifyOverrides={surveyNotifyOverrides}
          surveyNotifyUpdating={surveyNotifyUpdating}
          showInactive={false}
        />
      )}
    </div>
  );
}
