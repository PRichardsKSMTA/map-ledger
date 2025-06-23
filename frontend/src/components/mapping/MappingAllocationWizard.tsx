import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MappingTable from './MappingTable';
import RatioAllocationManager from './RatioAllocationManager';

export type Stage = 'mapping' | 'allocation';

interface MappingAllocationWizardProps {
  glUploadId: string;
}

export default function MappingAllocationWizard({ glUploadId }: MappingAllocationWizardProps) {
  const [searchParams] = useSearchParams();
  const initial = searchParams.get('stage') === 'allocation' ? 'allocation' : 'mapping';
  const [stage, setStage] = useState<Stage>(initial as Stage);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {stage === 'mapping' ? (
        <MappingTable
          onConfigureAllocation={id => {
            setActiveAccountId(id);
            setStage('allocation');
          }}
        />
      ) : (
        <RatioAllocationManager
          initialSourceAccountId={activeAccountId || undefined}
          onDone={() => setStage('mapping')}
        />
      )}
    </div>
  );
}
