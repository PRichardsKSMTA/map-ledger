import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, GripVertical, X, Percent } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { OperationalMetric } from '../../types';

export default function RatioAllocationBuilder() {
  const {
    allocations,
    metrics,
    selectedPeriod,
    setSelectedPeriod,
    updateAllocation,
  } = useRatioAllocationStore();

  const [selectedAllocation, setSelectedAllocation] = useState<string | null>(null);

  const periods = ['2024-08', '2024-09'];

  const getMetricsForDatapoint = (datapointId: string, period: string): OperationalMetric[] => {
    const metricMapping: { [key: string]: string[] } = {
      '4': ['driver-headcount'],
      '10': ['non-driver-headcount'],
    };

    const allowedTypes = metricMapping[datapointId] || [];
    return metrics.filter(m => 
      m.period === period && 
      allowedTypes.includes(m.type.toLowerCase())
    );
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedAllocation) return;

    const allocation = allocations.find(a => a.id === selectedAllocation);
    if (!allocation) return;

    const newTargetDatapoints = Array.from(allocation.targetDatapoints);
    const [reorderedItem] = newTargetDatapoints.splice(result.source.index, 1);
    newTargetDatapoints.splice(result.destination.index, 0, reorderedItem);

    updateAllocation(selectedAllocation, {
      ...allocation,
      targetDatapoints: newTargetDatapoints
    });
  };

  const handleAddTarget = (allocationId: string) => {
    const allocation = allocations.find(a => a.id === allocationId);
    if (!allocation) return;

    const newTarget = {
      datapointId: '4', // Default to Driver datapoint
      name: 'Driver Wages, Benefits and Payroll Taxes',
      ratioMetric: {
        id: metrics.find(m => m.type === 'driver-headcount' && m.period === selectedPeriod)?.id || '',
        name: 'Driver Headcount',
        value: 75
      }
    };

    updateAllocation(allocationId, {
      ...allocation,
      targetDatapoints: [...allocation.targetDatapoints, newTarget]
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Select Period</h3>
        </CardHeader>
        <CardContent>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={selectedPeriod || ''}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="">Select a period...</option>
            {periods.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Allocation Rules</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allocations.map((allocation) => (
                  <button
                    key={allocation.id}
                    onClick={() => setSelectedAllocation(allocation.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedAllocation === allocation.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{allocation.name}</span>
                      <span className="text-sm text-gray-500">
                        {allocation.targetDatapoints.length} targets
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {allocation.sourceAccount.description}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          {selectedAllocation && selectedPeriod && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">
                      {allocations.find(a => a.id === selectedAllocation)?.name}
                    </h3>
                    <button
                      onClick={() => handleAddTarget(selectedAllocation)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Target
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Droppable droppableId="targets">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {allocations
                          .find(a => a.id === selectedAllocation)
                          ?.targetDatapoints.map((target, index) => (
                            <Draggable
                              key={target.datapointId}
                              draggableId={target.datapointId}
                              index={index}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="bg-white rounded-lg border border-gray-200 shadow-sm"
                                >
                                  <div className="p-4">
                                    <div className="flex items-center">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="flex-shrink-0 mr-3"
                                      >
                                        <GripVertical className="h-5 w-5 text-gray-400" />
                                      </div>
                                      <div className="flex-1 grid grid-cols-12 gap-4">
                                        <div className="col-span-5">
                                          <label className="block text-sm font-medium text-gray-700">
                                            Target Datapoint
                                          </label>
                                          <select
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            value={target.datapointId}
                                            onChange={(e) => {
                                              const allocation = allocations.find(
                                                a => a.id === selectedAllocation
                                              );
                                              if (!allocation) return;

                                              const availableMetrics = getMetricsForDatapoint(e.target.value, selectedPeriod);
                                              const defaultMetric = availableMetrics[0];

                                              const newTargetDatapoints = allocation.targetDatapoints.map(
                                                (t, i) =>
                                                  i === index
                                                    ? {
                                                        ...t,
                                                        datapointId: e.target.value,
                                                        name: e.target.value === '4' 
                                                          ? 'Driver Wages, Benefits and Payroll Taxes'
                                                          : 'Non-Driver Wages, Benefits and Payroll Taxes',
                                                        ratioMetric: defaultMetric ? {
                                                          id: defaultMetric.id,
                                                          name: defaultMetric.name,
                                                          value: defaultMetric.value
                                                        } : t.ratioMetric
                                                      }
                                                    : t
                                              );

                                              updateAllocation(selectedAllocation, {
                                                ...allocation,
                                                targetDatapoints: newTargetDatapoints
                                              });
                                            }}
                                          >
                                            <option value="4">Driver Wages, Benefits and Payroll Taxes</option>
                                            <option value="10">Non-Driver Wages, Benefits and Payroll Taxes</option>
                                          </select>
                                        </div>
                                        <div className="col-span-5">
                                          <label className="block text-sm font-medium text-gray-700">
                                            Ratio Metric
                                          </label>
                                          <select
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            value={target.ratioMetric.id}
                                            onChange={(e) => {
                                              const allocation = allocations.find(
                                                a => a.id === selectedAllocation
                                              );
                                              if (!allocation) return;

                                              const availableMetrics = getMetricsForDatapoint(target.datapointId, selectedPeriod);
                                              const selectedMetric = availableMetrics.find(m => m.id === e.target.value);
                                              if (!selectedMetric) return;

                                              const newTargetDatapoints = allocation.targetDatapoints.map(
                                                (t, i) =>
                                                  i === index
                                                    ? {
                                                        ...t,
                                                        ratioMetric: {
                                                          id: selectedMetric.id,
                                                          name: selectedMetric.name,
                                                          value: selectedMetric.value
                                                        }
                                                      }
                                                    : t
                                              );

                                              updateAllocation(selectedAllocation, {
                                                ...allocation,
                                                targetDatapoints: newTargetDatapoints
                                              });
                                            }}
                                          >
                                            {getMetricsForDatapoint(target.datapointId, selectedPeriod).map((metric) => (
                                              <option key={metric.id} value={metric.id}>
                                                {metric.name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="col-span-2 flex items-end justify-end">
                                          <button
                                            onClick={() => {
                                              const allocation = allocations.find(
                                                a => a.id === selectedAllocation
                                              );
                                              if (!allocation) return;

                                              const newTargetDatapoints = allocation.targetDatapoints.filter(
                                                (_, i) => i !== index
                                              );

                                              updateAllocation(selectedAllocation, {
                                                ...allocation,
                                                targetDatapoints: newTargetDatapoints
                                              });
                                            }}
                                            className="inline-flex items-center p-2 border border-transparent rounded-md text-red-600 hover:bg-red-50"
                                          >
                                            <X className="h-5 w-5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </DragDropContext>
          )}
        </div>
      </div>

      {selectedAllocation && selectedPeriod && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Allocation Preview</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allocations
                .find(a => a.id === selectedAllocation)
                ?.targetDatapoints.map((target) => {
                  const allocation = allocations.find(a => a.id === selectedAllocation);
                  if (!allocation) return null;

                  const periodMetrics = metrics.filter(m => m.period === selectedPeriod);
                  const targetMetric = periodMetrics.find(m => 
                    m.type === (target.datapointId === '4' ? 'driver-headcount' : 'non-driver-headcount')
                  );

                  const totalMetricValue = allocation.targetDatapoints.reduce((sum, dp) => {
                    const metric = periodMetrics.find(m => 
                      m.type === (dp.datapointId === '4' ? 'driver-headcount' : 'non-driver-headcount')
                    );
                    return sum + (metric?.value || 0);
                  }, 0);

                  const percentage = totalMetricValue > 0 
                    ? ((targetMetric?.value || 0) / totalMetricValue) * 100
                    : 0;

                  return (
                    <div
                      key={target.datapointId}
                      className="flex items-center space-x-4"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {target.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {target.ratioMetric.name}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Percent className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">
                          {percentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}