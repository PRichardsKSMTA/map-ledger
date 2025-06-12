import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { FileSpreadsheet, AlertCircle, CheckCircle2, X, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { useImportStore } from '../store/importStore';
import ImportHistory from '../components/import/ImportHistory';
import ImportForm from '../components/import/ImportForm';

export default function Import() {
  const { user } = useAuthStore();
  const [isImporting, setIsImporting] = useState(false);
  const { imports, addImport } = useImportStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileImport = async (file: File, clientId: string) => {
    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        throw new Error('Please upload a CSV file');
      }

      // Read and validate CSV content
      const content = await file.text();
      const lines = content.split('\n');
      
      // Validate header row
      const header = lines[0].toLowerCase();
      const requiredColumns = ['gl_month_quarter', 'gl_account', 'gl_description', 'net_change'];
      const missingColumns = requiredColumns.filter(col => !header.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Get the period from the first data row
      const firstDataRow = lines[1]?.split(',');
      const period = firstDataRow?.[0] || new Date().toISOString();

      // Process the import
      const importId = crypto.randomUUID();
      addImport({
        id: importId,
        clientId,
        fileName: file.name,
        period,
        timestamp: new Date().toISOString(),
        status: 'completed',
        rowCount: lines.length - 1,
        importedBy: user?.email || '',
      });

      setSuccess('File imported successfully');
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
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <FileSpreadsheet className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Required CSV Format</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Your CSV file must include the following columns:
                    </p>
                    <ul className="mt-2 text-sm text-gray-500 list-disc list-inside space-y-1">
                      <li>GL_Month_Quarter (YYYY-MM or YYYY-Q#)</li>
                      <li>GL_Account</li>
                      <li>GL_Description</li>
                      <li>Net_Change</li>
                      <li>User_Defined_Field_1 (optional)</li>
                      <li>User_Defined_Field_2 (optional)</li>
                      <li>User_Defined_Field_3 (optional)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Important Notes</h3>
                    <ul className="mt-1 text-sm text-gray-500 list-disc list-inside space-y-1">
                      <li>Use comma (,) as the delimiter</li>
                      <li>Numbers should not include currency symbols</li>
                      <li>Use period (.) as decimal separator</li>
                      <li>First row must be the header row</li>
                      <li>GL_Month_Quarter format depends on template interval</li>
                      <li>Net_Change can be positive (debit) or negative (credit)</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => {
                      const template = `GL_Month_Quarter,GL_Account,GL_Description,Net_Change,User_Defined_Field_1,User_Defined_Field_2,User_Defined_Field_3
2024-01,5000-000,Sample Expense,1000,,,
2024-01,5100-000,Another Expense,2000,,,`;
                      const blob = new Blob([template], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'mapledger_template.csv';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium text-gray-900">Import History</h2>
        </CardHeader>
        <ImportHistory imports={imports} />
      </Card>
    </div>
  );
}