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

export interface UserClientOperation {
  id: string;
  name: string;
}

export interface UserClientCompany {
  companyId: string;
  companyName: string;
  operations: UserClientOperation[];
}

export interface UserClientMetadata {
  sourceAccounts: {
    id: string;
    name: string;
    description: string | null;
  }[];
  reportingPeriods: string[];
  mappingTypes: string[];
  targetSCoAs: string[];
  polarities: string[];
  presets: string[];
  exclusions: string[];
}

export interface UserClientAccess {
  clientId: string;
  clientName: string;
  companies: UserClientCompany[];
  metadata: UserClientMetadata;
}

export interface DatapointConfiguration {
  id: string;
  label: string | null;
  userEmail: string;
  userName: string | null;
  clientId: string;
  clientName: string;
  companyName: string | null;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  sourceAccountDescription: string | null;
  reportingPeriod: string | null;
  mappingType: string | null;
  targetSCoA: string | null;
  polarity: string | null;
  preset: string | null;
  operations: string[];
  exclusions: string[];
  configuration: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
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

export interface TargetScoaOption {
  id: string;
  value: string;
  label: string;
}

export interface ImportPreviewRow {
  entity: string;
  accountId: string;
  description: string;
  netChange: number;
  glMonth?: string;
}

export interface TrialBalanceRow {
  entity: string;
  accountId: string;
  description: string;
  netChange: number;
  glMonth?: string;
  [key: string]: unknown;
}

export interface Import {
  id: string;
  clientId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string;
  previewRows: ImportPreviewRow[];
  period: string;
  timestamp: string;
  status: 'completed' | 'failed';
  rowCount?: number;
  importedBy: string;
  userId: string;
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

export interface RatioAllocationTargetDatapoint {
  datapointId: string;
  name: string;
  groupId?: string;
  ratioMetric: {
    id: string;
    name: string;
    value: number;
  };
}

export interface RatioAllocation {
  id: string;
  name: string;
  sourceAccount: {
    id: string;
    number: string;
    description: string;
  };
  targetDatapoints: RatioAllocationTargetDatapoint[];
  effectiveDate: string;
  status: 'active' | 'inactive';
}

export interface AllocationResultTargetBreakdown {
  datapointId: string;
  targetId: string;
  targetName: string;
  basisValue: number;
  value: number;
  percentage: number;
  ratio: number;
}

export interface AllocationResultAdjustment {
  targetId: string;
  amount: number;
}

export interface AllocationResult {
  allocationId: string;
  allocationName: string;
  periodId: string;
  sourceAccountId: string;
  sourceAccountName: string;
  sourceValue: number;
  basisTotal: number;
  runAt: string;
  adjustment?: AllocationResultAdjustment;
  allocations: AllocationResultTargetBreakdown[];
}

export interface OperationalMetric {
  id: string;
  name: string;
  description: string;
  type: string;
  value: number;
  period: string;
}

export interface DynamicSourceAccount {
  id: string;
  name: string;
  number: string;
  description: string;
  /**
   * Default value used when period-specific balances are unavailable.
   */
  value: number;
  /**
   * Optional map of period identifier to balance so dynamic allocations can
   * run across multiple reporting cycles without hard-coding dates.
   */
  valuesByPeriod?: Record<string, number>;
}

export interface DynamicBasisAccount {
  id: string;
  name: string;
  description: string;
  /**
   * Default value used when a period-specific balance is not supplied.
   */
  value: number;
  mappedTargetId: string;
  /**
   * Optional map of period identifier to balance for dynamic ratios.
   */
  valuesByPeriod?: Record<string, number>;
}

export interface DynamicDatapointGroupMember {
  accountId: string;
  accountName: string;
}

export interface DynamicDatapointGroup {
  id: string;
  label: string;
  targetId: string;
  targetName: string;
  members: DynamicDatapointGroupMember[];
  notes?: string;
}

export interface DynamicAllocationBasisMember {
  accountId: string;
  accountName: string;
  value: number;
}

export interface DynamicAllocationTargetAudit {
  targetId: string;
  targetName: string;
  basisValue: number;
  ratio: number;
  allocation: number;
  basisMembers: DynamicAllocationBasisMember[];
}

export interface DynamicAllocationAuditRecord {
  id: string;
  allocationId: string;
  allocationName: string;
  periodId: string;
  runAt: string;
  sourceAccount: {
    id: string;
    number: string;
    description: string;
  };
  sourceAmount: number;
  basisTotal: number;
  targets: DynamicAllocationTargetAudit[];
  adjustment?: AllocationResultAdjustment;
  presetId?: string | null;
  userId?: string | null;
}

export interface DynamicAllocationValidationIssue {
  id: string;
  allocationId: string;
  periodId: string;
  sourceAccountId: string;
  sourceAccountName: string;
  message: string;
  targetIds?: string[];
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

export interface CompanyRef {
  id: string;
  name: string;
  clients: ClientRef[];
}

export interface GLAccountCompanyBreakdown {
  id: string;
  company: string;
  balance: number;
}

export type MappingStatus = 'Mapped' | 'Unmapped' | 'New' | 'Excluded';

export type MappingType = 'direct' | 'percentage' | 'dynamic' | 'exclude';

export type MappingExclusionType = 'none' | 'amount' | 'percentage' | 'dynamic';

export interface MappingExclusion {
  type: MappingExclusionType;
  amount?: number;
  percentage?: number;
  datapointId?: string;
  datapointName?: string;
  /**
   * Cached amount resolved from dynamic allocation results. Stored as a
   * positive value representing the absolute balance excluded from the
   * account, regardless of polarity.
   */
  resolvedAmount?: number;
}

export type MappingPolarity = 'Debit' | 'Credit' | 'Absolute';

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
  activity: number;
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
  activity: number;
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
  companies: GLAccountCompanyBreakdown[];
  exclusion?: MappingExclusion;
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
