import type { User } from '../types';

const COA_MANAGER_ALLOWLIST = [
  'pete.richards@ksmcpa.com',
  'chenry@ksmcpa.com',
  'chenry@ksmta.com',
];

export const canAccessCoaManager = (user?: Pick<User, 'email'> | null): boolean => {
  const email = user?.email?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  return COA_MANAGER_ALLOWLIST.includes(email);
};
