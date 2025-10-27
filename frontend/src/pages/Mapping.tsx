import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import MappingHeader from '../components/mapping/MappingHeader';
import StepTabs, { MappingStep } from '../components/mapping/StepTabs';
import SummaryCards from '../components/mapping/SummaryCards';
import MappingTable from '../components/mapping/MappingTable';
import DistributionTable from '../components/mapping/DistributionTable';
import ReviewPane from '../components/mapping/ReviewPane';

const stepParam = (value: string | null): MappingStep => {
  if (value === 'distribution' || value === 'review') {
    return value;
  }
  return 'mapping';
};

export default function Mapping() {
  const { uploadId = 'demo' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeStep, setActiveStep] = useState<MappingStep>(() => stepParam(searchParams.get('stage')));
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const urlStep = useMemo(() => stepParam(searchParams.get('stage')), [searchParams]);

  useEffect(() => {
    if (urlStep !== activeStep) {
      setActiveStep(urlStep);
      if (urlStep !== 'distribution') {
        setActiveAccountId(null);
      }
    }
  }, [urlStep, activeStep]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (next.get('stage') !== activeStep) {
      next.set('stage', activeStep);
      setSearchParams(next, { replace: true });
    }
  }, [activeStep, searchParams, setSearchParams]);

  const handleStepChange = (step: MappingStep) => {
    setActiveStep(step);
    if (step !== 'distribution') {
      setActiveAccountId(null);
    }
  };

  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 md:px-8">
        <MappingHeader glUploadId={uploadId} />
        <SummaryCards />
        <StepTabs activeStep={activeStep} onStepChange={handleStepChange} />
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {activeStep === 'mapping' && (
            <MappingTable
              onConfigureAllocation={accountId => {
                setActiveAccountId(accountId);
                setActiveStep('distribution');
              }}
            />
          )}
          {activeStep === 'distribution' && (
            <DistributionTable focusMappingId={activeAccountId} />
          )}
          {activeStep === 'review' && <ReviewPane />}
        </div>
      </div>
    </div>
  );
}
