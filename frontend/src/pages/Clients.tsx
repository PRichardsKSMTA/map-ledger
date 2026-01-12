import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import EntityManager from '../components/entities/EntityManager';
import ClientSurveyModal from '../components/survey/ClientSurveyModal';
import { useClientStore } from '../store/clientStore';

export default function Clients() {
  const clients = useClientStore(state => state.clients);
  const activeClientId = useClientStore(state => state.activeClientId);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeClient = useMemo(
    () => clients.find(client => client.clientId === activeClientId) ?? clients[0] ?? null,
    [activeClientId, clients],
  );

  useEffect(() => {
    const rawFlag = searchParams.get('openSurvey');
    const shouldOpen =
      rawFlag === '1' || rawFlag?.toLowerCase() === 'true';
    if (shouldOpen && !isSurveyOpen) {
      setIsSurveyOpen(true);
    }
  }, [isSurveyOpen, searchParams]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Admin</p>
        <h1 className="text-2xl font-semibold text-gray-900">Client Profiles & Entities</h1>
        <p className="text-sm text-gray-600">
          Manage client entities, display names, and statuses. Deleted entities are hidden from selection lists.
        </p>
      </header>

      <section
        aria-label="Monthly client survey"
        className="rounded-lg bg-white p-6 shadow"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
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
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              Open survey
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Client entities" className="rounded-lg bg-white p-6 shadow">
        <EntityManager />
      </section>

      <ClientSurveyModal
        open={isSurveyOpen}
        clientId={activeClientId}
        clientName={activeClient?.name ?? null}
        clientScac={activeClient?.scac ?? null}
        operations={activeClient?.operations ?? []}
        onClose={() => {
          setIsSurveyOpen(false);
          if (searchParams.get('openSurvey')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('openSurvey');
            setSearchParams(nextParams, { replace: true });
          }
        }}
      />
    </div>
  );
}
