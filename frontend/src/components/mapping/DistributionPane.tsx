import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Gauge,
  GitBranch,
  Loader2,
  Plus,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/Card';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { selectAccounts, useMappingStore } from '../../store/mappingStore';

const datapointOptions: { id: string; name: string }[] = [
  { id: '4', name: 'Driver Wages, Benefits and Payroll Taxes' },
  { id: '10', name: 'Non-Driver Wages, Benefits and Payroll Taxes' },
];

const datapointMetricMapping: Record<string, string[]> = {
  '4': ['driver-headcount'],
  '10': ['non-driver-headcount'],
};

const createLogId = () => `dist-${Math.random().toString(36).slice(2, 10)}`;

interface DistributionPaneProps {
  initialSourceAccountId?: string | null;
}

const DistributionPane = ({ initialSourceAccountId }: DistributionPaneProps) => {
  const accounts = useMappingStore(selectAccounts);
  const {
    allocations,
    metrics,
    selectedPeriod,
    setSelectedPeriod,
    updateAllocation,
    calculateAllocations,
    isProcessing,
    results,
    getOrCreateAllocation,
  } = useRatioAllocationStore(state => ({
    allocations: state.allocations,
    metrics: state.metrics,
    selectedPeriod: state.selectedPeriod,
    setSelectedPeriod: state.setSelectedPeriod,
    updateAllocation: state.updateAllocation,
    calculateAllocations: state.calculateAllocations,
    isProcessing: state.isProcessing,
    results: state.results,
    getOrCreateAllocation: state.getOrCreateAllocation,
  }));

  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [basisType, setBasisType] = useState<string>('driver-headcount');
  const [lastRecalcId, setLastRecalcId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAllocationId && allocations.length > 0) {
      setSelectedAllocationId(allocations[0].id);
    }
  }, [allocations, selectedAllocationId]);

  useEffect(() => {
    if (!initialSourceAccountId) {
      return;
    }
    const allocation = getOrCreateAllocation(initialSourceAccountId);
    setSelectedAllocationId(allocation.id);
  }, [initialSourceAccountId, getOrCreateAllocation]);

  const selectedAllocation = useMemo(
    () => allocations.find(allocation => allocation.id === selectedAllocationId) ?? null,
    [allocations, selectedAllocationId]
  );

  const availablePeriods = useMemo(() => {
    const unique = new Set(metrics.map(metric => metric.period));
    return Array.from(unique).sort();
  }, [metrics]);

  useEffect(() => {
    if (!selectedPeriod && availablePeriods.length > 0) {
      setSelectedPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, selectedPeriod, setSelectedPeriod]);

  const periodMetrics = useMemo(
    () => (selectedPeriod ? metrics.filter(metric => metric.period === selectedPeriod) : []),
    [metrics, selectedPeriod]
  );

  const basisOptions = useMemo(
    () => Array.from(new Set(periodMetrics.map(metric => metric.type))),
    [periodMetrics]
  );

  useEffect(() => {
    if (basisOptions.length === 0) {
      return;
    }
    if (!basisOptions.includes(basisType)) {
      setBasisType(basisOptions[0]);
    }
  }, [basisOptions, basisType]);

  useEffect(() => {
    if (!selectedAllocation || !basisOptions.includes(basisType) || !selectedPeriod) {
      return;
    }

    const preferredMetric = periodMetrics.find(metric => metric.type === basisType);
    if (!preferredMetric) {
      return;
    }

    const requiresUpdate = selectedAllocation.targetDatapoints.some(target => {
      const allowed = datapointMetricMapping[target.datapointId] ?? basisOptions;
      return allowed.includes(basisType) && target.ratioMetric.id !== preferredMetric.id;
    });

    if (!requiresUpdate) {
      return;
    }

    updateAllocation(selectedAllocation.id, {
      targetDatapoints: selectedAllocation.targetDatapoints.map(target => {
        const allowed = datapointMetricMapping[target.datapointId] ?? basisOptions;
        if (!allowed.includes(basisType)) {
          return target;
        }
        return {
          ...target,
          ratioMetric: {
            id: preferredMetric.id,
            name: preferredMetric.name,
            value: preferredMetric.value,
          },
        };
      }),
    });
  }, [basisOptions, basisType, periodMetrics, selectedAllocation, selectedPeriod, updateAllocation]);

  const getMetricsForDatapoint = (datapointId: string) => {
    const allowed = datapointMetricMapping[datapointId] ?? basisOptions;
    return periodMetrics.filter(metric => allowed.includes(metric.type));
  };

  const handleAddTarget = () => {
    if (!selectedAllocation) {
      return;
    }
    const datapoint = datapointOptions[0];
    const metricsForTarget = getMetricsForDatapoint(datapoint.id);
    const metric = metricsForTarget[0];

    updateAllocation(selectedAllocation.id, {
      targetDatapoints: [
        ...selectedAllocation.targetDatapoints,
        {
          datapointId: datapoint.id,
          name: datapoint.name,
          ratioMetric: metric
            ? { id: metric.id, name: metric.name, value: metric.value }
            : { id: createLogId(), name: 'Pending metric', value: 0 },
        },
      ],
    });
  };

  const handleTargetChange = (index: number, datapointId: string) => {
    if (!selectedAllocation) {
      return;
    }

    const datapoint = datapointOptions.find(option => option.id === datapointId) ?? datapointOptions[0];
    const metricsForTarget = getMetricsForDatapoint(datapoint.id);
    const metric = metricsForTarget[0];

    updateAllocation(selectedAllocation.id, {
      targetDatapoints: selectedAllocation.targetDatapoints.map((target, idx) =>
        idx === index
          ? {
              ...target,
              datapointId,
              name: datapoint.name,
              ratioMetric: metric
                ? { id: metric.id, name: metric.name, value: metric.value }
                : target.ratioMetric,
            }
          : target
      ),
    });
  };

  const handleMetricChange = (index: number, metricId: string) => {
    if (!selectedAllocation) {
      return;
    }

    const metric = periodMetrics.find(item => item.id === metricId);
    if (!metric) {
      return;
    }

    updateAllocation(selectedAllocation.id, {
      targetDatapoints: selectedAllocation.targetDatapoints.map((target, idx) =>
        idx === index
          ? {
              ...target,
              ratioMetric: { id: metric.id, name: metric.name, value: metric.value },
            }
          : target
      ),
    });
  };

  const handleRemoveTarget = (index: number) => {
    if (!selectedAllocation) {
      return;
    }

    updateAllocation(selectedAllocation.id, {
      targetDatapoints: selectedAllocation.targetDatapoints.filter((_, idx) => idx !== index),
    });
  };

  const handleRecalculate = async () => {
    if (!selectedPeriod) {
      return;
    }
    setLastRecalcId(createLogId());
    await calculateAllocations(selectedPeriod);
  };

  const operationWeights = useMemo(() => {
    if (accounts.length === 0) {
      return [] as { operation: string; value: number; share: number; accounts: number }[];
    }

    const totals = accounts.reduce((accumulator, account) => {
      const previous = accumulator.get(account.operation) ?? 0;
      return accumulator.set(account.operation, previous + Math.abs(account.balance));
    }, new Map<string, number>());

    const overall = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(totals.entries())
      .map(([operation, value]) => ({
        operation,
        value,
        share: overall > 0 ? (value / overall) * 100 : 0,
        accounts: accounts.filter(account => account.operation === operation).length,
      }))
      .sort((a, b) => b.value - a.value);
  }, [accounts]);

  const periodResult = useMemo(
    () => (selectedPeriod ? results.find(result => result.periodId === selectedPeriod) : undefined),
    [results, selectedPeriod]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SCoA tree</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Navigate the source accounts that require distribution.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {allocations.length === 0 ? (
              <p className="text-sm text-gray-500">No ratio allocations have been configured yet.</p>
            ) : (
              <ul className="space-y-3" role="tree">
                {allocations.map(allocation => {
                  const isActive = allocation.id === selectedAllocation?.id;
                  return (
                    <li key={allocation.id} role="treeitem" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => setSelectedAllocationId(allocation.id)}
                        className={`w-full rounded-md border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <GitBranch className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" aria-hidden="true" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-slate-100">
                              {allocation.sourceAccount.number} · {allocation.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {allocation.sourceAccount.description || 'No description provided'}
                            </div>
                            {allocation.targetDatapoints.length > 0 && (
                              <ul className="mt-2 space-y-1 pl-1 text-xs text-gray-500 dark:text-gray-400" role="group">
                                {allocation.targetDatapoints.map(target => (
                                  <li key={target.datapointId} className="flex items-center gap-2">
                                    <Target className="h-3 w-3 text-gray-400" aria-hidden="true" />
                                    <span>{target.name}</span>
                                    <span className="text-[11px] text-gray-400">· {target.ratioMetric.name}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dynamic basis selector</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Choose the reporting period and operational driver that should inform distribution percentages.
                  </p>
                </div>
                <div className="flex flex-col gap-3 text-sm text-gray-500 lg:flex-row lg:items-center">
                  <label className="flex flex-col text-left lg:flex-row lg:items-center lg:gap-2">
                    <span className="font-medium text-gray-700 dark:text-gray-200">Reporting period</span>
                    <select
                      className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                      value={selectedPeriod ?? ''}
                      onChange={event => setSelectedPeriod(event.target.value)}
                    >
                      <option value="" disabled>
                        Select period
                      </option>
                      {availablePeriods.map(period => (
                        <option key={period} value={period}>
                          {period}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col text-left lg:flex-row lg:items-center lg:gap-2">
                    <span className="font-medium text-gray-700 dark:text-gray-200">Basis metric</span>
                    <select
                      className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                      value={basisType}
                      onChange={event => setBasisType(event.target.value)}
                    >
                      {basisOptions.map(option => (
                        <option key={option} value={option}>
                          {option.replace(/-/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    className="inline-flex items-center justify-center rounded-md border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-500/10"
                    disabled={!selectedPeriod}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Calculating
                      </>
                    ) : (
                      <>
                        <Gauge className="mr-2 h-4 w-4" aria-hidden="true" />
                        Recalculate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {basisOptions.length === 0 ? (
                <p className="text-sm text-gray-500">Upload operational metrics to unlock dynamic allocations.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {periodMetrics
                    .filter(metric => metric.type === basisType)
                    .map(metric => (
                      <div
                        key={metric.id}
                        className="rounded-md border border-dashed border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-500/60 dark:bg-blue-500/10 dark:text-blue-200"
                      >
                        <div className="font-medium">{metric.name}</div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">{metric.description}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-blue-500 dark:text-blue-200">
                          Value: {metric.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation editor</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Adjust target datapoints and operational drivers for the selected GL source account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddTarget}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
                  disabled={!selectedAllocation}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add datapoint
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedAllocation ? (
                <p className="text-sm text-gray-500">Select a source account from the SCoA tree to begin editing its distribution.</p>
              ) : selectedAllocation.targetDatapoints.length === 0 ? (
                <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-slate-600 dark:text-gray-300">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <span>No target datapoints defined yet. Add a datapoint to allocate the source balance.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedAllocation.targetDatapoints.map((target, index) => (
                    <div key={target.datapointId} className="grid gap-4 rounded-md border border-gray-200 p-4 shadow-sm sm:grid-cols-12 dark:border-slate-700">
                      <div className="sm:col-span-5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`datapoint-${index}`}>
                          Target datapoint
                        </label>
                        <select
                          id={`datapoint-${index}`}
                          className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                          value={target.datapointId}
                          onChange={event => handleTargetChange(index, event.target.value)}
                        >
                          {datapointOptions.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`metric-${index}`}>
                          Operational driver
                        </label>
                        <select
                          id={`metric-${index}`}
                          className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                          value={target.ratioMetric.id}
                          onChange={event => handleMetricChange(index, event.target.value)}
                        >
                          {getMetricsForDatapoint(target.datapointId).map(metric => (
                            <option key={metric.id} value={metric.id}>
                              {metric.name} ({metric.value.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end justify-end sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveTarget(index)}
                          className="text-sm font-medium text-rose-600 transition hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:text-rose-300 dark:hover:text-rose-200 dark:focus-visible:ring-offset-slate-900"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {selectedAllocation && (
              <CardFooter>
                <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Distribution weights refresh automatically when operational metrics are updated for {selectedPeriod ?? 'the selected period'}.
                  </span>
                  {lastRecalcId && !isProcessing && (
                    <span className="text-gray-400 dark:text-gray-500">Last recalculated just now.</span>
                  )}
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Operation weighting</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review how mapped GL balances roll into operational groupings prior to allocation.
          </p>
        </CardHeader>
        <CardContent>
          {operationWeights.length === 0 ? (
            <p className="text-sm text-gray-500">No mapped accounts available to calculate operational weighting.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {operationWeights.map(weight => (
                <div
                  key={weight.operation}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{weight.operation}</span>
                    <span className="text-xs uppercase tracking-wide text-blue-500 dark:text-blue-300">{weight.share.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                    {weight.value.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {weight.accounts} GL account{weight.accounts === 1 ? '' : 's'} contributing
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation preview</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Preview the distribution output for the active period to validate driver selections.
          </p>
        </CardHeader>
        <CardContent>
          {!selectedPeriod ? (
            <p className="text-sm text-gray-500">Select a reporting period to view calculated allocations.</p>
          ) : !periodResult || periodResult.allocations.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-slate-600 dark:text-gray-300">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span>No calculated allocations found for {selectedPeriod}. Recalculate once drivers are configured.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
                <thead className="bg-gray-50 text-left dark:bg-slate-800">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">
                      Datapoint
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">
                      Allocated amount
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {periodResult.allocations.map(allocation => (
                    <tr key={allocation.datapointId}>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{allocation.datapointId}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {allocation.value.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{allocation.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionPane;
