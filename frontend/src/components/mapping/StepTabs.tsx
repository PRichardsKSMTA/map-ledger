export type MappingStep = 'mapping' | 'reconcile' | 'distribution' | 'review';

const DEFAULT_STEPS: { key: MappingStep; label: string; description?: string }[] = [
  { key: 'mapping', label: 'Mapping', description: 'Assign GL accounts to the chart of accounts' },
  {
    key: 'reconcile',
    label: 'Reconcile',
    description: 'Confirm mapped activity against the standard chart of accounts',
  },
  { key: 'distribution', label: 'Distribution', description: 'Configure allocation rules and drivers' },
  { key: 'review', label: 'Review', description: 'Validate allocations before publishing' },
];

interface StepTabsProps {
  activeStep: MappingStep;
  onStepChange: (step: MappingStep) => void;
  steps?: { key: MappingStep; label: string; description?: string }[];
}

const StepTabs = ({ activeStep, onStepChange, steps = DEFAULT_STEPS }: StepTabsProps) => {
  return (
    <div className="pb-1">
      <nav
        className="-mb-px flex flex-col gap-3 sm:flex-row"
        aria-label="Mapping workflow steps"
      >
        {steps.map(step => {
          const isActive = step.key === activeStep;
          const baseClasses =
            'group relative flex-1 rounded-t-xl px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 [clip-path:polygon(9%_0,91%_0,100%_100%,0_100%)]';
          const stateClasses = isActive
            ? ' -mb-px bg-blue-600 text-white shadow-lg ring-2 ring-blue-500 dark:bg-blue-500 dark:text-white'
            : ' bg-slate-100 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700';

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onStepChange(step.key)}
              className={`${baseClasses}${stateClasses}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="block text-base font-semibold">
                {step.label}
              </span>
              {step.description && (
                <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
                  {step.description}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default StepTabs;
