jest.mock('../src/utils/sqlClient', () => ({
  runQuery: jest.fn(),
}));

import { saveClientFileMetadata } from '../src/repositories/clientFileRepository';
import crypto from 'node:crypto';
import {
  listClientFiles,
  softDeleteClientFile,
} from '../src/repositories/clientFileRepository';
import { runQuery } from '../src/utils/sqlClient';

type RunQueryMock = jest.MockedFunction<typeof runQuery>;

describe('clientFileRepository.saveClientFileMetadata', () => {
  let mockedRunQuery: RunQueryMock;
  const guid = '12345678-1234-1234-1234-1234567890ab';

  beforeEach(() => {
    mockedRunQuery = runQuery as RunQueryMock;
    mockedRunQuery.mockReset();
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(guid);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates and returns a 36-character file upload GUID', async () => {
    mockedRunQuery
      .mockResolvedValueOnce({ recordset: [{ file_upload_id: 7, file_upload_guid: guid }] } as any)
      .mockResolvedValueOnce({ recordset: [] } as any)
      .mockResolvedValueOnce({ recordset: [] } as any);

    const record = {
      clientId: 'client-1',
      uploadedBy: 'Uploader',
      sourceFileName: 'file.csv',
      fileStorageUri: 'https://storage.example.com/file.csv',
      status: 'completed',
    };

    const saved = await saveClientFileMetadata(record);

    expect(saved.fileUploadGuid).toBe(guid);
    expect(saved.fileUploadGuid).toHaveLength(36);
    expect(mockedRunQuery.mock.calls[0][1]).toMatchObject({
      fileUploadGuid: guid,
    });
  });

  it('propagates GUID to selected sheets and entities with schema columns and timestamps', async () => {
    mockedRunQuery
      .mockResolvedValueOnce({ recordset: [{ file_upload_guid: guid }] } as any)
      .mockResolvedValueOnce({ recordset: [] } as any)
      .mockResolvedValueOnce({ recordset: [] } as any);

    const record = {
      clientId: 'client-1',
      userId: 'user-1',
      uploadedBy: 'Uploader',
      sourceFileName: 'file.csv',
      fileStorageUri: 'https://storage.example.com/file.csv',
      status: 'completed',
      sheets: [
        { sheetName: 'Sheet 1', rowCount: 5, isSelected: true, firstDataRowIndex: 2 },
        { sheetName: 'Sheet 2', rowCount: 0, isSelected: false },
      ],
      entities: [
        { entityId: 101, entityName: 'Entity One', rowCount: 10, isSelected: true },
        { entityId: 202, entityName: 'Entity Two', rowCount: 0, isSelected: false },
      ],
    };

    const saved = await saveClientFileMetadata(record);

    expect(saved.id).toBe(guid);
    expect(saved.fileUploadGuid).toBe(guid);
    expect(mockedRunQuery).toHaveBeenCalledTimes(3);

    expect(mockedRunQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO ml.CLIENT_FILE_SHEETS (FILE_UPLOAD_GUID'),
      expect.objectContaining({
        fileUploadGuid: guid,
        sheetName0: 'Sheet 1',
        isSelected0: 1,
        firstDataRowIndex0: 2,
        sheetRowCount0: 5,
        sheetName1: 'Sheet 2',
        isSelected1: 0,
        firstDataRowIndex1: null,
        sheetRowCount1: 0,
        updatedBy0: 'Uploader',
        updatedBy1: 'Uploader',
      })
    );

    expect(mockedRunQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO ml.CLIENT_FILE_ENTITIES (FILE_UPLOAD_GUID'),
      expect.objectContaining({
        fileUploadGuid: guid,
        entityId0: 101,
        entityName0: 'Entity One',
        entityRowCount0: 10,
        entityIsSelected0: 1,
        entityId1: 202,
        entityName1: 'Entity Two',
        entityRowCount1: 0,
        entityIsSelected1: 0,
        entityUpdatedBy0: 'Uploader',
        entityUpdatedBy1: 'Uploader',
      })
    );

    const sheetParams = mockedRunQuery.mock.calls[1][1] as Record<string, unknown>;
    const entityParams = mockedRunQuery.mock.calls[2][1] as Record<string, unknown>;

    expect(sheetParams.updated0).toEqual(expect.any(String));
    expect(sheetParams.updated1).toEqual(expect.any(String));

    expect(entityParams.entityUpdated0).toEqual(expect.any(String));
    expect(entityParams.entityUpdated1).toEqual(expect.any(String));
  });
});

describe('clientFileRepository.softDeleteClientFile', () => {
  let mockedRunQuery: RunQueryMock;

  beforeEach(() => {
    mockedRunQuery = runQuery as RunQueryMock;
    mockedRunQuery.mockReset();
  });

  it('marks a file as deleted by GUID', async () => {
    mockedRunQuery.mockResolvedValue({ recordset: [] } as any);

    await softDeleteClientFile('abcd-1234');

    expect(mockedRunQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET IS_DELETED = 1'),
      expect.objectContaining({ fileUploadGuid: 'abcd-1234' })
    );
  });
});

describe('clientFileRepository.listClientFiles', () => {
  let mockedRunQuery: RunQueryMock;

  beforeEach(() => {
    mockedRunQuery = runQuery as RunQueryMock;
    mockedRunQuery.mockReset();
  });

  it('excludes soft-deleted records and uses GUIDs for related lookups', async () => {
    mockedRunQuery
      .mockResolvedValueOnce({ recordset: [{ total: 1 }] } as any)
      .mockResolvedValueOnce({
        recordset: [
          {
            fileUploadGuid: 'guid-1',
            clientId: 'client-1',
            uploadedBy: 'user-1',
            sourceFileName: 'file.csv',
            fileStorageUri: 'uri',
            fileSize: 100,
            fileType: 'csv',
            fileStatus: 'completed',
            glPeriodStart: '2023-01',
            glPeriodEnd: '2023-02',
            rowCount: 10,
            lastStepCompletedDttm: new Date().toISOString(),
          },
        ],
      } as any)
      .mockResolvedValueOnce({ recordset: [] } as any)
      .mockResolvedValueOnce({ recordset: [] } as any);

    const result = await listClientFiles(undefined, undefined, 1, 10);

    expect(mockedRunQuery.mock.calls[0][0]).toContain('cf.IS_DELETED = 0');
    expect(mockedRunQuery.mock.calls[1][0]).toContain('cf.IS_DELETED = 0');
    expect(mockedRunQuery.mock.calls[2][1]).toMatchObject({ sheetFileGuid0: 'guid-1' });
    expect(mockedRunQuery.mock.calls[3][1]).toMatchObject({ entityFileGuid0: 'guid-1' });
    expect(result.items[0].fileUploadGuid).toBe('guid-1');
  });
});
