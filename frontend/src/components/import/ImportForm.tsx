import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, Download } from 'lucide-react';
import Select from '../ui/Select';
import MultiSelect from '../ui/MultiSelect';
import { useOrganizationStore } from '../../store/organizationStore';
import {
  parseTrialBalanceWorkbook,
  ParsedUpload,
} from '../../utils/parseTrialBalanceWorkbook';
import ColumnMatcher from './ColumnMatcher';
import ExcludeAccounts, { AccountRow } from './ExcludeAccounts';
import {
  getClientTemplateMapping,
  ClientTemplateConfig,
} from '../../utils/getClientTemplateMapping';
import PreviewTable from './PreviewTable';

const templateHeaders = [
  'GL ID',
  'Account Description',
  'Net Change',
  'Entity',
  'User Defined 1',
  'User Defined 2',
  'User Defined 3',
];

interface ImportFormProps {
  onImport: (
    uploads: AccountRow[],
    clientId: string,
    entityIds: string[],
    headerMap: Record<string, string | null>,
    glMonth: string,
    fileName: string,
    file: File
  ) => void | Promise<void>;
  isImporting: boolean;
}

export default function ImportForm({ onImport, isImporting }: ImportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { entities } = useOrganizationStore();
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState('');
  const [allRows, setAllRows] = useState<AccountRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [glMonth, setGlMonth] = useState('');
  const [uploads, setUploads] = useState<ParsedUpload[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<number>(0);
  const [headerMap, setHeaderMap] = useState<Record<
    string,
    string | null
  > | null>(null);
  const [includedRows, setIncludedRows] = useState<AccountRow[] | null>(null);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clientOptions = useMemo(() => {
    const all = entities.flatMap((e) => e.clients);
    return all.filter(
      (c, idx) => all.findIndex((cc) => cc.id === c.id) === idx
    );
  }, [entities]);

  const entityOptions = useMemo(() => {
    if (!clientId) return [];
    return entities.filter((e) => e.clients.some((c) => c.id === clientId));
  }, [clientId, entities]);

  useEffect(() => {
    if (entities.length === 1) {
      setEntityIds([entities[0].id]);
    }
  }, [entities]);

  useEffect(() => {
    if (clientOptions.length === 1) {
      setClientId(clientOptions[0].id);
    }
  }, [clientOptions]);

  useEffect(() => {
    const available = entityOptions.map((e) => e.id);
    if (available.length === 1) {
      setEntityIds([available[0]]);
    } else {
      setEntityIds([]);
    }
  }, [clientId, entityOptions]);

  useEffect(() => {
    if (uploads.length > 0) {
      setGlMonth(uploads[selectedSheet]?.metadata?.glMonth || '');
    }
  }, [uploads, selectedSheet]);

  useEffect(() => {
    const filtered = allRows.filter(
      (r) => !glMonth || r.glMonth === glMonth
    );
    setIncludedRows(filtered);
    const unique = Array.from(new Set(filtered.map((r) => r.entity).filter(Boolean)));
    setAvailableEntities(unique);
  }, [glMonth, allRows]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    try {
      if (!clientId || entityIds.length === 0) {
        setError('Please select a client and entity before uploading.');
        setSelectedFile(null);
        setSelectedSheet(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const clientConfig: ClientTemplateConfig | null =
        await getClientTemplateMapping(clientId);
      console.log('Fetched client config:', clientConfig);

      const parsed = await parseTrialBalanceWorkbook(file); // Future: pass config to this function
      if (parsed.length === 0)
        throw new Error('No valid data found in any sheet.');

      setUploads(parsed);
      setSelectedSheet(0);
      setSelectedFile(file);
      setHeaderMap(null);
      setIncludedRows(null);
      setAvailableEntities([]);
      setGlMonth(parsed[0]?.metadata?.glMonth || '');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setUploads([]);
      setSelectedSheet(0);
      setSelectedFile(null);
      setHeaderMap(null);
      setIncludedRows(null);
      setAvailableEntities([]);
      setAllRows([]);
    }
  };

  const handleColumnMatch = (map: Record<string, string | null>) => {
    setHeaderMap(map);

    const keyMap = Object.entries(map).reduce(
      (acc, [dest, src]) => {
        if (src) acc[dest] = src;
        return acc;
      },
      {} as Record<string, string>
    );

    const sheet = uploads[selectedSheet];
    const rows: AccountRow[] = sheet.rows.map((row) => ({
      accountId: row[keyMap['GL ID']]?.toString() || '',
      description: row[keyMap['Account Description']]?.toString() || '',
      netChange: Number(row[keyMap['Net Change']]) || 0,
      entity: row[keyMap['Entity']]?.toString() || '',
      glMonth: sheet.metadata.glMonth,
      ...row,
    }));

    const uniqueEntities = Array.from(
      new Set(rows.map((r) => r.entity).filter(Boolean))
    );
    setAvailableEntities(uniqueEntities);
    setAllRows(rows);
    setIncludedRows(
      rows.filter((r) => !glMonth || r.glMonth === glMonth)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      selectedFile &&
      clientId &&
      entityIds.length > 0 &&
      includedRows &&
      headerMap &&
      glMonth
    ) {
      await onImport(
        includedRows,
        clientId,
        entityIds,
        headerMap,
        glMonth,
        selectedFile.name,
        selectedFile
      );
    } else {
      setError(
        'Please complete all steps including column matching, GL Month, and account review.'
      );
    }
  };

  const downloadTemplate = () => {
    const template = `GL_Month_Quarter,GL_Account,GL_Description,Net_Change\n2024-01,5000-000,Sample Expense,1000\n2024-01,5100-000,Another Expense,2000`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapledger_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Select
        label="Client"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        required
        disabled={clientOptions.length === 0}
      >
        {clientOptions.length > 1 && <option value="">Select a client</option>}
        {clientOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <MultiSelect
        label="Entity"
        options={entityOptions.map((ent) => ({ value: ent.id, label: ent.name }))}
        value={entityIds}
        onChange={setEntityIds}
        disabled={!clientId}
      />


      <div
        className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-center">
          {selectedFile ? (
            <div className="flex items-center justify-center space-x-2">
              <span className="text-sm text-gray-900">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setUploads([]);
                  setSelectedSheet(0);
                  setHeaderMap(null);
                  setIncludedRows(null);
                  setAvailableEntities([]);
                  setAllRows([]);
                  setGlMonth('');
                  setClientId('');
                  setEntityIds(entities.length === 1 ? [entities[0].id] : []);
                }}
                className="text-gray-500 hover:text-red-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    name="file-upload"
                    type="file"
                    accept=".csv, .xlsx"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                Excel files with multiple sheets supported
              </p>
            </>
          )}
        </div>
      </div>

      {uploads.length > 1 && (
        <Select
          label="Sheet"
          value={selectedSheet.toString()}
          onChange={(e) => {
            setSelectedSheet(Number(e.target.value));
            setHeaderMap(null);
            setIncludedRows(null);
          }}
        >
          {uploads.map((u, idx) => (
            <option key={u.sheetName} value={idx}>
              {u.sheetName}
            </option>
          ))}
        </Select>
      )}

      {uploads.length > 0 && !headerMap && (
        <ColumnMatcher
          sourceHeaders={uploads[selectedSheet].headers}
          destinationHeaders={templateHeaders}
          onComplete={handleColumnMatch}
        />
      )}

      {headerMap && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="gl-month"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              GL Month
            </label>
            <input
              type="month"
              id="gl-month"
              name="gl-month"
              value={glMonth}
              onChange={(e) => setGlMonth(e.target.value)}
              required
              className="block w-40 border rounded-md px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          {includedRows && (
            <ExcludeAccounts
              rows={includedRows}
              onConfirm={(included) => {
                setIncludedRows(included);
              }}
            />
          )}
        </div>
      )}

      {includedRows && includedRows.length > 0 && (
        <PreviewTable rows={includedRows} />
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {includedRows && headerMap && (
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </button>

          <button
            type="submit"
            disabled={
              !selectedFile ||
              !clientId ||
              entityIds.length === 0 ||
              isImporting ||
              uploads.length === 0 ||
              !headerMap ||
              !glMonth
            }
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import File
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
