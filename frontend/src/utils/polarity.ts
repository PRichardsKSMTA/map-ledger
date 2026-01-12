import type { MappingPolarity } from '../types';

export const derivePolarityFromAmount = (amount: number): MappingPolarity => {
  if (amount > 0) {
    return 'Debit';
  }
  if (amount < 0) {
    return 'Credit';
  }
  return 'Absolute';
};

export const applyPolarityToAmount = (
  amount: number,
  polarity: MappingPolarity,
): number => {
  if (!Number.isFinite(amount) || amount === 0) {
    return 0;
  }
  const absolute = Math.abs(amount);
  if (polarity === 'Credit') {
    return -absolute;
  }
  return absolute;
};
