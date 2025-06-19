import RatioAllocationManager from "../components/mapping/RatioAllocationManager";
import MappingTable from "../components/mapping/MappingTable";

export default function Mapping() {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">GL Mapping</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-8">
        <MappingTable />
        <div className="py-4">
          <RatioAllocationManager />
        </div>
      </div>
    </div>
  );
}