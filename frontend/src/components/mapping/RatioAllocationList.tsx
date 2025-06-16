import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Calculator, ArrowRight } from 'lucide-react';

const RatioAllocationList = () => {
  const { allocations, selectedPeriod, results } = useRatioAllocationStore();

  return (
    <div className="space-y-4">
      {allocations.map((allocation) => (
        <Card key={allocation.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">{allocation.name}</h3>
              <span className="text-sm text-gray-500">
                {allocation.sourceAccount.number}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-500">
                {allocation.sourceAccount.description}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allocation.targetDatapoints.map((target) => (
                  <div
                    key={target.datapointId}
                    className="flex items-center p-4 bg-gray-50 rounded-lg"
                  >
                    <Calculator className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium">{target.name}</div>
                      <div className="text-sm text-gray-500">
                        via {target.ratioMetric.name}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 mx-3" />
                    <div className="text-sm font-medium">
                      {(
                        (target.ratioMetric.value /
                          allocation.targetDatapoints.reduce(
                            (sum, dp) => sum + dp.ratioMetric.value,
                            0
                          )) *
                        100
                      ).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>

              {selectedPeriod && results.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    Current Allocation
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results
                      .find((r) => r.periodId === selectedPeriod)
                      ?.allocations.map((result, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center"
                        >
                          <span className="text-sm text-blue-700">
                            {
                              allocation.targetDatapoints.find(
                                (t) => t.datapointId === result.datapointId
                              )?.name
                            }
                          </span>
                          <span className="text-sm font-medium text-blue-900">
                            ${result.value.toFixed(2)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default RatioAllocationList;