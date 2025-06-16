import { create } from 'zustand';
import { Import } from '../types';

// Sample import data
const sampleImports: Import[] = [
  {
    id: '1',
    clientId: 'TRNS',
    fileName: 'january_2024_tb.csv',
    period: '2024-01-01T00:00:00.000Z',
    timestamp: '2024-01-15T10:30:00.000Z',
    status: 'completed',
    rowCount: 150,
    importedBy: 'john.doe@example.com'
  },
  {
    id: '2',
    clientId: 'HLTH',
    fileName: 'february_2024_tb.csv',
    period: '2024-02-01T00:00:00.000Z',
    timestamp: '2024-02-15T14:20:00.000Z',
    status: 'completed',
    rowCount: 180,
    importedBy: 'jane.smith@example.com'
  }
];

interface ImportState {
  imports: Import[];
  addImport: (importData: Import) => void;
}

export const useImportStore = create<ImportState>((set) => ({
  imports: sampleImports,
  addImport: (importData) =>
    set((state) => ({
      imports: [importData, ...state.imports],
    })),
}));