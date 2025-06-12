import { useState } from 'react';
import RatioAllocationBuilder from './RatioAllocationBuilder';
import RatioAllocationList from './RatioAllocationList';
import { Calculator, List } from 'lucide-react';

const RatioAllocationManager = () => {
  const [activeView, setActiveView] = useState<'list' | 'builder'>('builder');
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Ratio Allocations</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage and configure your ratio-based allocation rules
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveView('list')}
            className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
              activeView === 'list'
                ? 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <List className="h-4 w-4 mr-2" />
            List View
          </button>
          <button
            onClick={() => setActiveView('builder')}
            className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
              activeView === 'builder'
                ? 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <Calculator className="h-4 w-4 mr-2" />
            Builder
          </button>
        </div>
      </div>

      {activeView === 'builder' ? (
        <RatioAllocationBuilder />
      ) : (
        <RatioAllocationList />
      )}
    </div>
  );
};

export default RatioAllocationManager;