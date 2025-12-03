import { ClientFileMetadataPayload, validateRecord } from '../src/functions/clientFiles';

describe('clientFiles.validateRecord', () => {
  const basePayload: ClientFileMetadataPayload = {
    clientId: 'client-123',
    sourceFileName: 'trial_balance.csv',
    fileStatus: 'completed',
  };

  it('accepts fileStorageUri values provided directly', () => {
    const payload: ClientFileMetadataPayload = {
      ...basePayload,
      fileStorageUri: 'https://storage.example.com/blob.csv',
    };

    const { record, errors } = validateRecord(payload);

    expect(errors).toHaveLength(0);
    expect(record?.fileStorageUri).toBe(payload.fileStorageUri);
  });

  it('accepts common upload aliases such as fileUri', () => {
    const payload: ClientFileMetadataPayload = {
      ...basePayload,
      fileUri: 'https://storage.example.com/blob.csv',
    };

    const { record, errors } = validateRecord(payload);

    expect(errors).toHaveLength(0);
    expect(record?.fileStorageUri).toBe(payload.fileUri);
  });

  it('derives the storage URI from the upload context when not provided at the top level', () => {
    const payload: ClientFileMetadataPayload = {
      ...basePayload,
      uploadContext: {
        blobUrl: 'https://storage.example.com/contextual.csv',
      },
    };

    const { record, errors } = validateRecord(payload);

    expect(errors).toHaveLength(0);
    expect(record?.fileStorageUri).toBe('https://storage.example.com/contextual.csv');
  });

  it('returns an error when no upload location is present', () => {
    const { record, errors } = validateRecord(basePayload);

    expect(record).toBeNull();
    expect(errors).toContain('fileStorageUri (or fileUri/blobUrl) is required');
  });

  it('parses sheet and entity selections with sensible defaults', () => {
    const payload: ClientFileMetadataPayload = {
      ...basePayload,
      fileStorageUri: 'https://storage.example.com/blob.csv',
      sheets: [
        {
          sheetName: ' Sheet A ',
          rowCount: '12' as unknown as number,
          isSelected: 'false' as unknown as boolean,
          firstDataRowIndex: '3' as unknown as number,
        },
      ],
      entities: [
        {
          entityId: '42' as unknown as number,
          entityName: 'Consolidated',
          rowCount: '9' as unknown as number,
          isSelected: '0' as unknown as boolean,
        },
      ],
    };

    const { record, errors } = validateRecord(payload);

    expect(errors).toHaveLength(0);
    expect(record?.sheets).toEqual([
      {
        sheetName: 'Sheet A',
        rowCount: 12,
        isSelected: false,
        firstDataRowIndex: 3,
      },
    ]);
    expect(record?.entities).toEqual([
      {
        entityId: 42,
        entityName: 'Consolidated',
        displayName: undefined,
        rowCount: 9,
        isSelected: false,
      },
    ]);
  });

  it('merges detected sheets from the upload context with user selections', () => {
    const payload: ClientFileMetadataPayload = {
      ...basePayload,
      fileStorageUri: 'https://storage.example.com/blob.csv',
      uploadContext: {
        sheets: [
          { sheetName: 'Sheet A', rowCount: 10, firstDataRowIndex: 2 },
          { sheetName: 'Sheet B', rowCount: 5 },
        ],
      },
      sheets: [
        {
          sheetName: 'Sheet B',
          rowCount: 7,
          isSelected: true,
        },
      ],
    };

    const { record, errors } = validateRecord(payload);

    expect(errors).toHaveLength(0);
    expect(record?.sheets).toEqual([
      {
        sheetName: 'Sheet A',
        rowCount: 10,
        isSelected: false,
        firstDataRowIndex: 2,
      },
      {
        sheetName: 'Sheet B',
        rowCount: 7,
        isSelected: true,
      },
    ]);
  });
});
