import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import type { AppUser, AppUserRole } from '../../services/appUserService';

interface AppUserFormProps {
  user: AppUser;
  onSubmit: (data: { firstName: string; lastName: string; displayName: string; role: AppUserRole }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function AppUserForm({ user, onSubmit, onCancel, isSubmitting }: AppUserFormProps) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<AppUserRole>(user.role);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setError('');
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      displayName: displayName.trim() || `${firstName.trim()} ${lastName.trim()}`,
      role,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter first name"
          disabled={isSubmitting}
        />

        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter last name"
          disabled={isSubmitting}
        />

        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter display name (optional)"
          className="md:col-span-2"
          disabled={isSubmitting}
        />

        <div className="md:col-span-2">
          <Input label="Email Address" value={user.email} disabled className="bg-gray-50 dark:bg-gray-800" />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Email is linked to Azure AD and cannot be changed
          </p>
        </div>

        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as AppUserRole)}
          className="md:col-span-2"
          disabled={isSubmitting}
        >
          <option value="viewer">Viewer - Can view data but cannot make changes</option>
          <option value="admin">Admin - Can view and edit data</option>
          <option value="super">Super User - Full access including user management</option>
        </Select>
      </div>

      <div className="flex justify-end space-x-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
