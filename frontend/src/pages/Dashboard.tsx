import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import ClientSurveyModal from '../components/survey/ClientSurveyModal';
import { useAuthStore } from '../store/authStore';
import { useClientStore } from '../store/clientStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const clients = useClientStore(state => state.clients);
  const activeClientId = useClientStore(state => state.activeClientId);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);

  const activeClient = useMemo(
    () => clients.find(client => client.clientId === activeClientId) ?? clients[0] ?? null,
    [activeClientId, clients],
  );

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {user?.firstName}!</h1>
      </header>
      <section
        aria-label="Dashboard content"
        className="rounded-lg bg-white p-6 shadow"
      >
        <p className="text-gray-700">Your dashboard content will appear here.</p>
      </section>

      <section
        aria-label="Monthly client survey"
        className="rounded-lg bg-white p-6 shadow"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
              <ClipboardList className="h-4 w-4" />
              Client Survey
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Monthly operational statistics</h2>
            <p className="text-sm text-gray-600">
              Capture the latest driver counts, terminal totals, and other operational metrics for{' '}
              {activeClient?.name ?? 'the selected client'}.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="text-xs text-gray-500">
              {activeClientId ? `Active client: ${activeClient?.name ?? activeClientId}` : 'Select a client to begin.'}
            </div>
            <button
              type="button"
              onClick={() => setIsSurveyOpen(true)}
              disabled={!activeClientId}
              className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              Open survey
            </button>
          </div>
        </div>
      </section>

      <ClientSurveyModal
        open={isSurveyOpen}
        clientId={activeClientId}
        clientName={activeClient?.name ?? null}
        operations={activeClient?.operations ?? []}
        onClose={() => setIsSurveyOpen(false)}
      />
    </div>
  );
}
