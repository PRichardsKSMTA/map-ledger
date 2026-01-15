import { Edit, Trash2, RotateCcw, Shield, ShieldAlert, ShieldCheck, UserX } from 'lucide-react';
import { Card } from '../ui/Card';
import type { AppUser, AppUserRole } from '../../services/appUserService';

interface AppUserListProps {
  users: AppUser[];
  currentUserEmail?: string;
  onEdit: (user: AppUser) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
  showInactive: boolean;
}

export default function AppUserList({
  users,
  currentUserEmail,
  onEdit,
  onDeactivate,
  onReactivate,
  showInactive,
}: AppUserListProps) {
  const getRoleIcon = (role: AppUserRole) => {
    switch (role) {
      case 'super':
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case 'admin':
        return <ShieldCheck className="h-5 w-5 text-blue-500" />;
      case 'viewer':
        return <Shield className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: AppUserRole) => {
    const styles = {
      super: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };

    const labels = {
      super: 'Super User',
      admin: 'Admin',
      viewer: 'Viewer',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[role]}`}
      >
        {labels[role]}
      </span>
    );
  };

  const isCurrentUser = (user: AppUser) =>
    currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase();

  if (users.length === 0) {
    return (
      <Card>
        <div className="py-12 text-center">
          <UserX className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            No users found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {showInactive
              ? 'No users have been added yet.'
              : 'No active users found. Toggle "Show inactive" to see deactivated users.'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full table-compact divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr
                key={user.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  !user.isActive ? 'opacity-60' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.displayName}
                      </div>
                      {isCurrentUser(user) && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">(You)</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getRoleIcon(user.role)}
                    {getRoleBadge(user.role)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-gray-100">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => onEdit(user)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Edit user"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    {!isCurrentUser(user) && (
                      <>
                        {user.isActive ? (
                          <button
                            onClick={() => onDeactivate(user.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Deactivate user"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onReactivate(user.id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Reactivate user"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
