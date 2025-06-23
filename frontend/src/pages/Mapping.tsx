import { useParams } from 'react-router-dom';
import MappingAllocationWizard from "../components/mapping/MappingAllocationWizard";

export default function Mapping() {
  const { uploadId = 'demo' } = useParams();
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">GL Mapping</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <MappingAllocationWizard glUploadId={uploadId} />
      </div>
    </div>
  );
}