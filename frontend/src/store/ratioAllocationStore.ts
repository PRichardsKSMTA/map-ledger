import { create } from 'zustand';
import { RatioAllocation, AllocationResult, OperationalMetric } from '../types';

const sampleMetrics: OperationalMetric[] = [
  {
    id: '1',
    name: 'Driver Headcount',
    description: 'Total number of drivers',
    type: 'driver-headcount',
    value: 75,
    period: '2024-08'
  },
  {
    id: '2',
    name: 'Non-Driver Headcount',
    description: 'Total number of non-driver employees',
    type: 'non-driver-headcount',
    value: 25,
    period: '2024-08'
  },
  {
    id: '3',
    name: 'Driver Headcount',
    description: 'Total number of drivers',
    type: 'driver-headcount',
    value: 80,
    period: '2024-09'
  },
  {
    id: '4',
    name: 'Non-Driver Headcount',
    description: 'Total number of non-driver employees',
    type: 'non-driver-headcount',
    value: 20,
    period: '2024-09'
  }
];

const sampleAllocations: RatioAllocation[] = [
  {
    id: '1',
    name: 'Payroll Tax Allocation',
    sourceAccount: {
      id: '1234456',
      number: '1234456',
      description: 'Payroll Taxes'
    },
    targetDatapoints: [
      {
        datapointId: '4',
        name: 'Driver Wages, Benefits and Payroll Taxes',
        ratioMetric: {
          id: '1',
          name: 'Driver Headcount',
          value: 75
        }
      },
      {
        datapointId: '10',
        name: 'Non-Driver Wages, Benefits and Payroll Taxes',
        ratioMetric: {
          id: '2',
          name: 'Non-Driver Headcount',
          value: 25
        }
      }
    ],
    effectiveDate: '2024-08-01',
    status: 'active'
  }
];

interface RatioAllocationState {
  allocations: RatioAllocation[];
  metrics: OperationalMetric[];
  isProcessing: boolean;
  selectedPeriod: string | null;
  results: AllocationResult[];
  addAllocation: (allocation: Omit<RatioAllocation, 'id'>) => void;
  updateAllocation: (id: string, allocation: Partial<RatioAllocation>) => void;
  deleteAllocation: (id: string) => void;
  setSelectedPeriod: (period: string) => void;
  calculateAllocations: (periodId: string) => Promise<void>;
}

export const useRatioAllocationStore = create<RatioAllocationState>((set, get) => ({
  allocations: sampleAllocations,
  metrics: sampleMetrics,
  isProcessing: false,
  selectedPeriod: null,
  results: [],
  
  addAllocation: (allocation) => {
    set((state) => ({
      allocations: [...state.allocations, { ...allocation, id: crypto.randomUUID() }],
    }));
  },

  updateAllocation: (id, allocation) => {
    set((state) => {
      const periodMetrics = state.metrics.filter(m => m.period === state.selectedPeriod);
      const updatedAllocation = { ...allocation };

      // Update metric values based on selected period
      if (updatedAllocation.targetDatapoints) {
        updatedAllocation.targetDatapoints = updatedAllocation.targetDatapoints.map(target => {
          const currentPeriodMetric = periodMetrics.find(m => 
            m.type === (target.datapointId === '4' ? 'driver-headcount' : 'non-driver-headcount')
          );
          
          if (currentPeriodMetric) {
            return {
              ...target,
              ratioMetric: {
                ...target.ratioMetric,
                id: currentPeriodMetric.id,
                value: currentPeriodMetric.value
              }
            };
          }
          return target;
        });
      }

      return {
        allocations: state.allocations.map((a) => 
          a.id === id ? { ...a, ...updatedAllocation } : a
        ),
      };
    });
  },

  deleteAllocation: (id) => {
    set((state) => ({
      allocations: state.allocations.filter((a) => a.id !== id),
    }));
  },

  setSelectedPeriod: (period) => {
    set((state) => {
      const periodMetrics = state.metrics.filter(m => m.period === period);
      
      // Update all allocations with new period metrics
      const updatedAllocations = state.allocations.map(allocation => ({
        ...allocation,
        targetDatapoints: allocation.targetDatapoints.map(target => {
          const newMetric = periodMetrics.find(m => 
            m.type === (target.datapointId === '4' ? 'driver-headcount' : 'non-driver-headcount')
          );
          
          if (newMetric) {
            return {
              ...target,
              ratioMetric: {
                ...target.ratioMetric,
                id: newMetric.id,
                value: newMetric.value
              }
            };
          }
          return target;
        })
      }));

      return {
        selectedPeriod: period,
        allocations: updatedAllocations
      };
    });
    get().calculateAllocations(period);
  },

  calculateAllocations: async (periodId: string) => {
    set({ isProcessing: true });
    try {
      const sourceValue = 10000;
      const periodMetrics = get().metrics.filter(m => m.period === periodId);
      
      const results = get().allocations.map(allocation => {
        const allocations = allocation.targetDatapoints.map(target => {
          const currentMetric = periodMetrics.find(m => 
            m.type === (target.datapointId === '4' ? 'driver-headcount' : 'non-driver-headcount')
          );
          
          const totalMetricValue = allocation.targetDatapoints.reduce((sum, dp) => {
            const metric = periodMetrics.find(m => 
              m.type === (dp.datapointId === '4' ? 'driver-headcount' : 'non-driver-headcount')
            );
            return sum + (metric?.value || 0);
          }, 0);

          const percentage = totalMetricValue > 0 
            ? ((currentMetric?.value || 0) / totalMetricValue)
            : 0;

          return {
            datapointId: target.datapointId,
            value: sourceValue * percentage,
            percentage: percentage * 100
          };
        });

        return {
          periodId,
          sourceValue,
          allocations
        };
      });
      
      set({ results, isProcessing: false });
    } catch (error) {
      set({ isProcessing: false });
      console.error('Error calculating allocations:', error);
      throw error;
    }
  },
}));