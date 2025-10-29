import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { useImportStore } from '../store/importStore';
import ImportHistory from '../components/import/ImportHistory';
import ImportForm from '../components/import/ImportForm';
import TemplateGuide from '../components/import/TemplateGuide';
import { fileToBase64 } from '../utils/file';
import { ImportPreviewRow, TrialBalanceRow } from '../types';
import { useMappingStore } from '../store/mappingStore';

export default function Import() {
  const { user } = useAuthStore();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const [isImporting, setIsImporting] = useState(false);
  const addImport = useImportStore((state) => state.addImport);
  const deleteImport = useImportStore((state) => state.deleteImport);
  const imports = useImportStore((state) =>
    userId ? state.importsByUser[userId] ?? [] : []
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDeleteImport = (importId: string) => {
    if (!userId) {
      return;
    }

    deleteImport(userId, importId);
    setError(null);
    setSuccess('Import removed from history');
  };

  const loadImportedAccounts = useMappingStore(state => state.loadImportedAccounts);

  const handleFileImport = async (
    rows: TrialBalanceRow[],
    clientId: string,
    _companyIds: string[],
    _headerMap: Record<string, string | null>,
    glMonth: string,
    fileName: string,
    file: File
  ) => {
    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!user) {
        throw new Error('You must be signed in to upload files.');
      }

      const importId = crypto.randomUUID();
      const previewRows: ImportPreviewRow[] = rows.slice(0, 10).map((row) => ({
        accountId: row.accountId,
        description: row.description,
        entity: row.entity,
        netChange: row.netChange,
        glMonth: row.glMonth,
      }));
      const fileData = await fileToBase64(file);
      const fileType = file.type || 'application/octet-stream';

      addImport(user.id, {
        id: importId,
        clientId,
        fileName,
        fileSize: file.size,
        fileType,
        fileData,
        previewRows,
        period: glMonth,
        timestamp: new Date().toISOString(),
        status: 'completed',
        rowCount: rows.length,
        importedBy: user.email,
      });

      loadImportedAccounts({
        uploadId: importId,
        clientId,
        companyIds: _companyIds,
        period: glMonth,
        rows,
      });

      setSuccess('File imported successfully');
      navigate(`/gl/mapping/${importId}?stage=mapping`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Data Import</h1>
          <p className="mt-1 text-sm text-gray-500">
            Import trial balance data from CSV files
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setSuccess(null)}
                  className="inline-flex rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Import Trial Balance</h2>
            </CardHeader>
            <CardContent>
              <ImportForm
                onImport={handleFileImport}
                isImporting={isImporting}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Template Guide</h2>
            </CardHeader>
            <CardContent>
              <TemplateGuide />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium text-gray-900">Import History</h2>
        </CardHeader>
        <ImportHistory imports={imports} onDeleteImport={handleDeleteImport} />
      </Card>
    </div>
  );
}