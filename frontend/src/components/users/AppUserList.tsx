import { useMemo, useState } from 'react';
import { ArrowUpDown, Edit, RotateCcw, Trash2, UserX } from 'lucide-react';
import { Card } from '../ui/Card';
import Select from '../ui/Select';
import type { AppUser, AppUserRole } from '../../services/appUserService';

type SortKey =
  | 'displayName'
  | 'clientName'
  | 'role'
  | 'monthlyClosingDate'
  | 'surveyNotify'
  | 'email'
  | 'status';
type SortDirection = 'asc' | 'desc';

interface AppUserListProps {
  users: AppUser[];
  currentUserEmail?: string;
  onEdit: (user: AppUser) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onRoleChange: (user: AppUser, role: AppUserRole) => void;
  onMonthlyClosingDateChange: (user: AppUser, value: number | null) => void;
  onSurveyNotifyChange: (user: AppUser, value: boolean) => void;
  roleOverrides: Record<string, AppUserRole | undefined>;
  roleUpdating: Record<string, boolean | undefined>;
  monthlyClosingDateOverrides: Record<string, number | null | undefined>;
  monthlyClosingDateUpdating: Record<string, boolean | undefined>;
  surveyNotifyOverrides: Record<string, boolean | undefined>;
  surveyNotifyUpdating: Record<string, boolean | undefined>;
  showInactive: boolean;
}

export default function AppUserList({
  users,
  currentUserEmail,
  onEdit,
  onDeactivate,
  onReactivate,
  onRoleChange,
  onMonthlyClosingDateChange,
  onSurveyNotifyChange,
  roleOverrides,
  roleUpdating,
  monthlyClosingDateOverrides,
  monthlyClosingDateUpdating,
  surveyNotifyOverrides,
  surveyNotifyUpdating,
  showInactive,
}: AppUserListProps) {
  const isCurrentUser = (user: AppUser) =>
    currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase();

  const getRoleValue = (user: AppUser) => roleOverrides[user.id] ?? user.role;
  const getMonthlyClosingDateValue = (user: AppUser) =>
    monthlyClosingDateOverrides[user.id] ?? user.monthlyClosingDate ?? null;
  const getSurveyNotifyValue = (user: AppUser) =>
    surveyNotifyOverrides[user.id] ?? user.surveyNotify;
  const [sortKey, setSortKey] = useState<SortKey>('displayName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedUsers = useMemo(() => {
    const sorted = [...users];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'displayName':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'clientName':
          comparison = (a.clientName ?? '').localeCompare(b.clientName ?? '');
          break;
        case 'monthlyClosingDate':
          comparison = (a.monthlyClosingDate ?? -1) - (b.monthlyClosingDate ?? -1);
          break;
        case 'surveyNotify':
          comparison = Number(a.surveyNotify) - Number(b.surveyNotify);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'status':
          comparison = Number(a.isActive) - Number(b.isActive);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [users, sortDirection, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const renderSortButton = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex items-center space-x-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      aria-sort={sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );

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
              : 'No active users found.'}
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
                {renderSortButton('User', 'displayName')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {renderSortButton('Client', 'clientName')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {renderSortButton('Role', 'role')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {renderSortButton('Monthly Closing Date', 'monthlyClosingDate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {renderSortButton('Survey Notify', 'surveyNotify')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {renderSortButton('Email', 'email')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {renderSortButton('Status', 'status')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedUsers.map((user) => (
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
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {user.clientName ?? '—'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Select
                    value={getRoleValue(user)}
                    onChange={(e) => onRoleChange(user, e.target.value as AppUserRole)}
                    selectClassName="py-2 text-xs min-w-[120px] max-w-[180px]"
                    disabled={Boolean(roleUpdating[user.id]) || (isCurrentUser(user) && user.role === 'super')}
                    aria-label={`Role for ${user.displayName}`}
                    title={
                      isCurrentUser(user) && user.role === 'super'
                        ? 'Your role must remain Super User to access this page.'
                        : undefined
                    }
                  >
                    <option value="viewer" disabled={Boolean(isCurrentUser(user))}>
                      Viewer - View only
                    </option>
                    <option value="admin" disabled={Boolean(isCurrentUser(user))}>
                      Admin - View and edit data
                    </option>
                    <option value="super">Super User - Full access</option>
                  </Select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Select
                    value={getMonthlyClosingDateValue(user) ?? ''}
                    onChange={(e) =>
                      onMonthlyClosingDateChange(
                        user,
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    selectClassName="py-2 text-xs min-w-[90px] max-w-[120px]"
                    disabled={Boolean(monthlyClosingDateUpdating[user.id])}
                    aria-label={`Monthly closing date for ${user.displayName}`}
                  >
                    <option value="">Not set</option>
                    {Array.from({ length: 28 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {index + 1}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Select
                    value={getSurveyNotifyValue(user) ? 'true' : 'false'}
                    onChange={(e) => onSurveyNotifyChange(user, e.target.value === 'true')}
                    selectClassName="py-2 text-xs min-w-[90px] max-w-[120px]"
                    disabled={Boolean(surveyNotifyUpdating[user.id])}
                    aria-label={`Survey notify for ${user.displayName}`}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </Select>
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
