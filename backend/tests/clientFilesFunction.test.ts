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
});
