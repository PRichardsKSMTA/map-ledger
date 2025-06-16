import { create } from 'zustand';
import { COATemplate, Datapoint } from '../types';

// Sample template data
const sampleTemplates: COATemplate[] = [
  {
    id: '1',
    name: 'Transportation Industry Template',
    industry: 'Transportation',
    interval: 'Monthly',
    functionalGroups: [
      { id: 'fg1', name: 'Operations', code: '100' },
      { id: 'fg2', name: 'Maintenance', code: '200' },
      { id: 'fg3', name: 'Administration', code: '300' }
    ],
    operationalGroups: [
      { id: 'og1', name: 'Fleet Management', code: '400' },
      { id: 'og2', name: 'Driver Operations', code: '500' },
      { id: 'og3', name: 'Logistics', code: '600' }
    ]
  },
  {
    id: '2',
    name: 'Healthcare Standard Template',
    industry: 'Healthcare',
    interval: 'Quarterly',
    functionalGroups: [
      { id: 'fg4', name: 'Patient Care', code: '100' },
      { id: 'fg5', name: 'Medical Services', code: '200' },
      { id: 'fg6', name: 'Support Services', code: '300' }
    ],
    operationalGroups: [
      { id: 'og4', name: 'Inpatient', code: '400' },
      { id: 'og5', name: 'Outpatient', code: '500' },
      { id: 'og6', name: 'Emergency', code: '600' }
    ]
  }
];

// Sample datapoints
const sampleDatapoints: Record<string, Datapoint[]> = {
  '1': [
    {
      id: 'dp1',
      templateId: '1',
      accountName: 'Fuel Expenses',
      accountDescription: 'All fuel-related expenses for fleet operations',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '5100',
      functionalGroupId: 'fg1',
      operationalGroupId: 'og1',
      sortOrder: 0
    },
    {
      id: 'dp2',
      templateId: '1',
      accountName: 'Vehicle Maintenance',
      accountDescription: 'Regular maintenance and repairs',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '5200',
      functionalGroupId: 'fg2',
      operationalGroupId: 'og1',
      sortOrder: 1
    },
    {
      id: 'dp3',
      templateId: '1',
      accountName: 'Driver Salaries',
      accountDescription: 'Base salaries for drivers',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '5300',
      functionalGroupId: 'fg1',
      operationalGroupId: 'og2',
      sortOrder: 2
    }
  ],
  '2': [
    {
      id: 'dp4',
      templateId: '2',
      accountName: 'Patient Revenue',
      accountDescription: 'Revenue from patient services',
      type: 'Financial',
      accountType: 'Revenue',
      balanceType: 'Credit',
      coreGLAccount: '4100',
      functionalGroupId: 'fg4',
      operationalGroupId: 'og4',
      sortOrder: 0
    },
    {
      id: 'dp5',
      templateId: '2',
      accountName: 'Medical Supplies',
      accountDescription: 'Medical supplies and equipment',
      type: 'Financial',
      accountType: 'Expenses',
      balanceType: 'Debit',
      coreGLAccount: '5100',
      functionalGroupId: 'fg5',
      operationalGroupId: 'og4',
      sortOrder: 1
    }
  ]
};

interface TemplateState {
  templates: COATemplate[];
  datapoints: Record<string, Datapoint[]>;
  addTemplate: (template: Omit<COATemplate, 'id'>) => void;
  updateTemplate: (id: string, template: Omit<COATemplate, 'id'>) => void;
  deleteTemplate: (id: string) => void;
  addDatapoint: (templateId: string, datapoint: Omit<Datapoint, 'id' | 'templateId' | 'sortOrder'>) => void;
  updateDatapoint: (templateId: string, datapointId: string, datapoint: Omit<Datapoint, 'id' | 'templateId' | 'sortOrder'>) => void;
  deleteDatapoint: (templateId: string, datapointId: string) => void;
  reorderDatapoints: (templateId: string, datapointIds: string[]) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  // Initialize with sample data
  templates: sampleTemplates,
  datapoints: sampleDatapoints,
  addTemplate: (template) =>
    set((state) => ({
      templates: [...state.templates, { ...template, id: crypto.randomUUID() }],
    })),
  updateTemplate: (id, template) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...template, id } : t
      ),
    })),
  deleteTemplate: (id) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      datapoints: Object.fromEntries(
        Object.entries(state.datapoints).filter(([key]) => key !== id)
      ),
    })),
  addDatapoint: (templateId, datapoint) =>
    set((state) => {
      const templateDatapoints = state.datapoints[templateId] || [];
      const newDatapoint: Datapoint = {
        ...datapoint,
        id: crypto.randomUUID(),
        templateId,
        sortOrder: templateDatapoints.length,
      };
      return {
        datapoints: {
          ...state.datapoints,
          [templateId]: [...templateDatapoints, newDatapoint],
        },
      };
    }),
  updateDatapoint: (templateId, datapointId, datapoint) =>
    set((state) => ({
      datapoints: {
        ...state.datapoints,
        [templateId]: (state.datapoints[templateId] || []).map((dp) =>
          dp.id === datapointId
            ? { ...datapoint, id: datapointId, templateId, sortOrder: dp.sortOrder }
            : dp
        ),
      },
    })),
  deleteDatapoint: (templateId, datapointId) =>
    set((state) => ({
      datapoints: {
        ...state.datapoints,
        [templateId]: (state.datapoints[templateId] || [])
          .filter((dp) => dp.id !== datapointId)
          .map((dp, index) => ({ ...dp, sortOrder: index })),
      },
    })),
  reorderDatapoints: (templateId, datapointIds) =>
    set((state) => ({
      datapoints: {
        ...state.datapoints,
        [templateId]: datapointIds
          .map((id, index) => {
            const dp = state.datapoints[templateId]?.find((d) => d.id === id);
            return dp ? { ...dp, sortOrder: index } : null;
          })
          .filter((dp): dp is Datapoint => dp !== null),
      },
    })),
}));