import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useMappingStore } from '../../store/mappingStore';
import { useTemplateStore } from '../../store/templateStore';

export default function MappingTable() {
  const { accounts, setManualMapping, bulkAccept, finalizeMappings } = useMappingStore();
  const { datapoints } = useTemplateStore();
  const coaOptions = datapoints['1'] || [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <button
          onClick={bulkAccept}
          className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Bulk Accept
        </button>
        <button
          onClick={finalizeMappings}
          className="px-3 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
        >
          Save Mappings
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2" />
              <th className="p-2">Account ID</th>
              <th className="p-2">Account Name</th>
              <th className="p-2 text-right">Balance</th>
              <th className="p-2">Operation</th>
              <th className="p-2">Distribution</th>
              <th className="p-2">Value</th>
              <th className="p-2">Suggested COA</th>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Confidence</th>
              <th className="p-2">Manual Override</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <>
                <tr
                  key={acc.id}
                  className={`border-t ${
                    acc.confidenceScore >= 90
                      ? 'bg-green-50'
                      : !acc.suggestedCOAId || acc.confidenceScore < 90
                        ? 'bg-red-50'
                        : ''
                  }`}
                >
                  <td className="p-2">
                    <button onClick={() => toggleRow(acc.id)} className="p-1">
                      {expanded.has(acc.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="p-2">{acc.accountId}</td>
                  <td className="p-2">{acc.accountName}</td>
                  <td className="p-2 text-right">{acc.balance.toFixed(2)}</td>
                  <td className="p-2">{acc.operation}</td>
                  <td className="p-2">{acc.distributionMethod}</td>
                  <td className="p-2">{acc.distributionValue ?? '-'}</td>
                  <td className="p-2">{acc.suggestedCOAId}</td>
                  <td className="p-2">{acc.suggestedCOADescription}</td>
                  <td className="p-2 text-right">{acc.confidenceScore}%</td>
                  <td className="p-2">
                    <select
                      className="border rounded p-1"
                      value={acc.manualCOAId || acc.suggestedCOAId || ''}
                      onChange={e => setManualMapping(acc.id, e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {coaOptions.map(opt => (
                        <option key={opt.id} value={opt.coreGLAccount}>
                          {opt.accountName}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                {expanded.has(acc.id) && acc.entities.map(ent => (
                  <tr key={ent.id} className="border-t bg-gray-50">
                    <td className="p-2" />
                    <td colSpan={2} className="p-2 pl-8">
                      {ent.entity}
                    </td>
                    <td className="p-2 text-right">{ent.balance.toFixed(2)}</td>
                    <td colSpan={7} />
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
