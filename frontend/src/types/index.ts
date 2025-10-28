import type { IdTokenClaims as TokenClaims } from '@azure/msal-browser';

export interface GroupTokenClaims extends TokenClaims {
  groups?: string[];
  [key: string]: unknown;
}

export type UserRole = 'super' | 'admin' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export interface ClientProfile {
  id: string;
  clientId: string;
  industry: string;
  name: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  accountingSystem: string;
}

export interface COATemplate {
  id: string;
  name: string;
  industry: string;
  interval: 'Monthly' | 'Quarterly';
  functionalGroups: {
    id: string;
    name: string;
    code: string;
  }[];
  operationalGroups: {
    id: string;
    name: string;
    code: string;
  }[];
}

export interface Datapoint {
  id: string;
  templateId: string;
  accountName: string;
  accountDescription: string;
  type: 'Financial' | 'Operational' | 'Calculated';
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  balanceType: 'Debit' | 'Credit';
  coreGLAccount: string;
  /**
   * 1 denotes a leaf account in the COA, 2 denotes a roll-up group
   */
  detailLevel?: number;
  functionalGroupId: string;
  operationalGroupId: string;
  formula?: string;
  sortOrder: number;
}

export interface Import {
  id: string;
  clientId: string;
  fileName: string;
  period: string;
  timestamp: string;
  status: 'completed' | 'failed';
  rowCount?: number;
  importedBy: string;
}

export interface SyncedAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  balance: number;
  lastSync: string;
  mapped: boolean;
}

export interface SyncHistory {
  id: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
  affectedAccounts: number;
}

export interface ConnectionStatus {
  connected: boolean;
  lastSync?: string;
  company?: string;
  environment?: string;
  error?: string;
}

export interface RatioAllocation {
  id: string;
  name: string;
  sourceAccount: {
    id: string;
    number: string;
    description: string;
  };
  targetDatapoints: {
    datapointId: string;
    name: string;
    ratioMetric: {
      id: string;
      name: string;
      value: number;
    };
  }[];
  effectiveDate: string;
  status: 'active' | 'inactive';
}

export interface AllocationResult {
  periodId: string;
  sourceValue: number;
  allocations: {
    datapointId: string;
    value: number;
    percentage: number;
  }[];
}

export interface OperationalMetric {
  id: string;
  name: string;
  description: string;
  type: string;
  value: number;
  period: string;
}
export interface OperationRef {
  id: string; // SCAC code
  name: string;
}

export interface ClientRef {
  id: string;
  name: string;
  operations: OperationRef[];
}

export interface EntityRef {
  id: string;
  name: string;
  clients: ClientRef[];
}

export interface GLAccountEntityBreakdown {
  id: string;
  entity: string;
  balance: number;
}

export type MappingStatus = 'Mapped' | 'Unmapped' | 'New' | 'Excluded';

export type MappingType = 'direct' | 'percentage' | 'dynamic' | 'exclude';

export type MappingPolarity = 'Debit' | 'Credit';

export interface MappingSplitDefinition {
  id: string;
  targetId: string;
  targetName: string;
  allocationType: 'percentage' | 'amount';
  allocationValue: number;
  notes?: string;
}

export type DistributionType = 'direct' | 'percentage' | 'dynamic';

export interface DistributionOperationShare {
  id: string;
  name: string;
  allocation?: number;
}

export interface DistributionRow {
  id: string;
  mappingRowId: string;
  accountId: string;
  description: string;
  activity: string;
  type: DistributionType;
  operations: DistributionOperationShare[];
  presetId?: string | null;
  notes?: string;
  status: MappingStatus;
}

export interface GLAccountMappingRow {
  id: string;
  companyId: string;
  companyName: string;
  entityId?: string;
  entityName?: string;
  accountId: string;
  accountName: string;
  activity: string;
  status: MappingStatus;
  mappingType: MappingType;
  netChange: number;
  operation: string;
  suggestedCOAId?: string;
  suggestedCOADescription?: string;
  aiConfidence?: number;
  manualCOAId?: string;
  polarity: MappingPolarity;
  presetId?: string;
  notes?: string;
  splitDefinitions: MappingSplitDefinition[];
  entities: GLAccountEntityBreakdown[];
}

export interface GLUpload {
  id: string;
  masterClientId: string;
  uploadedBy: string;
  fileName: string;
  fileUrl: string;
  operationIds?: string[];
  allocationRules?: string;
  uploadDate: string;
  status: 'Uploaded' | 'Processing' | 'Processed' | 'Error';
  errorMessage?: string;
}

export interface GLAccountRaw {
  id: string;
  glUploadId: string;
  accountCode: string;
  description: string;
  debit?: number;
  credit?: number;
  balance: number;
}

export interface MappingSuggestion {
  id: string;
  glAccountRawId: string;
  suggestedCOACode?: string;
  suggestedCOADesc?: string;
  confidenceScore?: number;
  aiResponseJson?: string;
  createdDate: string;
}

export interface FinalMapping {
  id: string;
  glAccountRawId: string;
  mappedCOAAccountId: string;
  mappedBy: string;
  mappedDate: string;
}
