import { COATemplate, Datapoint } from '../types';

export const TRANSPORT_TEMPLATE_ID = 'template-transport';
export const HEALTHCARE_TEMPLATE_ID = 'template-healthcare';

export const FUEL_EXPENSE_DATAPOINT_ID = 'dp-fuel';
export const MAINTENANCE_EXPENSE_DATAPOINT_ID = 'dp-maintenance';
export const PERSONNEL_EXPENSE_DATAPOINT_ID = 'dp-personnel';
export const BENEFITS_EXPENSE_DATAPOINT_ID = 'dp-benefits';
export const DRIVER_COMPENSATION_DATAPOINT_ID = 'dp-driver-comp';
export const NON_DRIVER_COMPENSATION_DATAPOINT_ID = 'dp-non-driver-comp';

const templates: COATemplate[] = [
  {
    id: TRANSPORT_TEMPLATE_ID,
    name: 'Transportation Industry Template',
    industry: 'Transportation',
    interval: 'Monthly',
    functionalGroups: [
      { id: 'fg-ops', name: 'Operations', code: '100' },
      { id: 'fg-maint', name: 'Maintenance', code: '200' },
      { id: 'fg-admin', name: 'Administration', code: '300' },
    ],
    operationalGroups: [
      { id: 'og-fleet', name: 'Fleet Management', code: '400' },
      { id: 'og-driver', name: 'Driver Operations', code: '500' },
      { id: 'og-logistics', name: 'Logistics', code: '600' },
      { id: 'og-shared', name: 'Shared Services', code: '700' },
    ],
  },
  {
    id: HEALTHCARE_TEMPLATE_ID,
    name: 'Healthcare Standard Template',
    industry: 'Healthcare',
    interval: 'Quarterly',
    functionalGroups: [
      { id: 'fg-patient-care', name: 'Patient Care', code: '100' },
      { id: 'fg-medical', name: 'Medical Services', code: '200' },
      { id: 'fg-support', name: 'Support Services', code: '300' },
    ],
    operationalGroups: [
      { id: 'og-inpatient', name: 'Inpatient', code: '400' },
      { id: 'og-outpatient', name: 'Outpatient', code: '500' },
      { id: 'og-emergency', name: 'Emergency', code: '600' },
    ],
  },
];

const datapoints: Record<string, Datapoint[]> = {
  [TRANSPORT_TEMPLATE_ID]: [
    {
      id: FUEL_EXPENSE_DATAPOINT_ID,
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Fuel Expense',
      accountDescription: 'All fuel-related expenses for fleet operations',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6100',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-fleet',
      sortOrder: 0,
    },
    {
      id: MAINTENANCE_EXPENSE_DATAPOINT_ID,
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Maintenance Expense',
      accountDescription: 'Repairs and upkeep for rolling stock',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6200',
      functionalGroupId: 'fg-maint',
      operationalGroupId: 'og-fleet',
      sortOrder: 1,
    },
    {
      id: PERSONNEL_EXPENSE_DATAPOINT_ID,
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Personnel Expense',
      accountDescription: 'Compensation for operations personnel',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6300',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-driver',
      sortOrder: 2,
    },
    {
      id: BENEFITS_EXPENSE_DATAPOINT_ID,
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Benefits Expense',
      accountDescription: 'Healthcare, insurance, and ancillary employee benefits',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6305',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-driver',
      sortOrder: 3,
    },
    {
      id: DRIVER_COMPENSATION_DATAPOINT_ID,
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Driver Wages, Benefits and Payroll Taxes',
      accountDescription: 'All compensation and payroll taxes for driver workforce',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6310',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-driver',
      sortOrder: 4,
    },
    {
      id: NON_DRIVER_COMPENSATION_DATAPOINT_ID,
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Non-Driver Wages, Benefits and Payroll Taxes',
      accountDescription: 'Compensation and payroll taxes for administrative teams',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6315',
      functionalGroupId: 'fg-admin',
      operationalGroupId: 'og-shared',
      sortOrder: 5,
    },
    {
      id: 'dp-fuel-expenses',
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Fuel Expenses',
      accountDescription: 'General fuel purchases across the fleet',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6110',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-fleet',
      sortOrder: 6,
    },
    {
      id: 'dp-vehicle-maintenance',
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Vehicle Maintenance',
      accountDescription: 'Scheduled service and inspections for vehicles',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6205',
      functionalGroupId: 'fg-maint',
      operationalGroupId: 'og-fleet',
      sortOrder: 7,
    },
    {
      id: 'dp-driver-salaries',
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Driver Salaries',
      accountDescription: 'Base salaries for drivers',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '6320',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-driver',
      sortOrder: 8,
    },
    {
      id: 'dp-payroll-taxes',
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Payroll Taxes',
      accountDescription: 'Employer payroll tax obligations',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '5200',
      functionalGroupId: 'fg-admin',
      operationalGroupId: 'og-shared',
      sortOrder: 9,
    },
    {
      id: 'dp-linehaul-revenue',
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Linehaul Revenue',
      accountDescription: 'Primary freight revenue for long-haul moves',
      type: 'Financial',
      accountType: 'Revenue',
      balanceType: 'Credit',
      coreGLAccount: '4100',
      functionalGroupId: 'fg-ops',
      operationalGroupId: 'og-logistics',
      sortOrder: 10,
    },
    {
      id: 'dp-legacy-clearing',
      templateId: TRANSPORT_TEMPLATE_ID,
      accountName: 'Legacy Clearing',
      accountDescription: 'Clearing account for legacy system transitions',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '8999',
      functionalGroupId: 'fg-admin',
      operationalGroupId: 'og-shared',
      sortOrder: 11,
    },
  ],
  [HEALTHCARE_TEMPLATE_ID]: [
    {
      id: 'dp-patient-revenue',
      templateId: HEALTHCARE_TEMPLATE_ID,
      accountName: 'Patient Revenue',
      accountDescription: 'Revenue from patient services',
      type: 'Financial',
      accountType: 'Revenue',
      balanceType: 'Credit',
      coreGLAccount: '4110',
      functionalGroupId: 'fg-patient-care',
      operationalGroupId: 'og-inpatient',
      sortOrder: 0,
    },
    {
      id: 'dp-medical-supplies',
      templateId: HEALTHCARE_TEMPLATE_ID,
      accountName: 'Medical Supplies',
      accountDescription: 'Medical supplies and equipment',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '5120',
      functionalGroupId: 'fg-medical',
      operationalGroupId: 'og-inpatient',
      sortOrder: 1,
    },
  ],
};

export const COA_SEED_TEMPLATES = templates;
export const COA_SEED_DATAPOINTS = datapoints;

export const createSeedTemplates = (): COATemplate[] =>
  templates.map(template => ({
    ...template,
    functionalGroups: template.functionalGroups.map(group => ({ ...group })),
    operationalGroups: template.operationalGroups.map(group => ({ ...group })),
  }));

export const createSeedDatapoints = (): Record<string, Datapoint[]> =>
  Object.fromEntries(
    Object.entries(datapoints).map(([templateId, templateDatapoints]) => [
      templateId,
      templateDatapoints.map(datapoint => ({ ...datapoint })),
    ]),
  );

export const listSeedDatapoints = (): Datapoint[] =>
  Object.values(datapoints)
    .flat()
    .map(datapoint => ({ ...datapoint }));
