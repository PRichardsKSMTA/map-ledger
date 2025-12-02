jest.mock('../src/utils/sqlClient', () => ({
  runQuery: jest.fn(),
}));

import { saveClientFileMetadata } from '../src/repositories/clientFileRepository';
import { runQuery } from '../src/utils/sqlClient';

type RunQueryMock = jest.MockedFunction<typeof runQuery>;

describe('clientFileRepository.saveClientFileMetadata', () => {
  let mockedRunQuery: RunQueryMock;

  beforeEach(() => {
    mockedRunQuery = runQuery as RunQueryMock;
    mockedRunQuery.mockReset();
  });

  it('inserts selected sheets and entities with schema columns and timestamps', async () => {
    mockedRunQuery
      .mockResolvedValueOnce({ recordset: [{ file_upload_id: 7 }] } as any)
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

    expect(saved.id).toBe(7);
    expect(mockedRunQuery).toHaveBeenCalledTimes(3);

    expect(mockedRunQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO ml.CLIENT_FILE_SHEETS'),
      expect.objectContaining({
        fileUploadId: 7,
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
      expect.stringContaining('INSERT INTO ml.CLIENT_FILE_ENTITIES'),
      expect.objectContaining({
        fileUploadId: 7,
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

    expect(sheetParams.inserted0).toEqual(expect.any(String));
    expect(sheetParams.updated0).toEqual(expect.any(String));
    expect(sheetParams.inserted1).toEqual(expect.any(String));
    expect(sheetParams.updated1).toEqual(expect.any(String));

    expect(entityParams.entityInserted0).toEqual(expect.any(String));
    expect(entityParams.entityUpdated0).toEqual(expect.any(String));
    expect(entityParams.entityInserted1).toEqual(expect.any(String));
    expect(entityParams.entityUpdated1).toEqual(expect.any(String));
  });
});
