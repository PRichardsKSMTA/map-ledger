jest.mock('../src/utils/sqlClient', () => ({
  runQuery: jest.fn(),
}));

import { insertFileRecords, listFileRecords } from '../src/repositories/fileRecordRepository';
import { runQuery } from '../src/utils/sqlClient';

type RunQueryMock = jest.MockedFunction<typeof runQuery>;

describe('fileRecordRepository', () => {
  let mockedRunQuery: RunQueryMock;
  const guid = '12345678-1234-1234-1234-1234567890ab';

  beforeEach(() => {
    mockedRunQuery = runQuery as RunQueryMock;
    mockedRunQuery.mockReset();
  });

  it('inserts file records with GUID, metadata, and relies on defaults for timestamps', async () => {
    const inserted = new Date('2024-01-01T00:00:00.000Z');
    mockedRunQuery.mockResolvedValue({ recordset: [{ record_id: 10, inserted_dttm: inserted }, { record_id: 11 }] } as any);

    const insertedRecords = await insertFileRecords(guid, [
      {
        accountId: '100',
        accountName: 'Cash',
        activityAmount: 50,
        entityId: 'ent-1',
        entityName: 'Entity One',
        glMonth: '2024-01',
        sourceSheet: 'Sheet1',
        sourceRowNumber: 10,
        openingBalance: 5,
        closingBalance: 55,
        userDefined1: 'u1',
        userDefined2: 'u2',
        userDefined3: 'u3',
      },
      {
        accountId: '200',
        accountName: 'Receivables',
        activityAmount: -5,
        sourceSheet: 'Sheet1',
        sourceRowNumber: 11,
      },
    ]);

    expect(mockedRunQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockedRunQuery.mock.calls[0];
    expect(sql).toContain('FILE_UPLOAD_GUID');
    expect(sql).toContain('SOURCE_ROW_NUMBER');
    expect(sql).toContain('ENTITY_NAME');
    expect(sql).not.toContain('UPDATED_DTTM');
    expect(sql).not.toContain('UPDATED_BY');

    expect(params).toMatchObject({
      fileUploadGuid: guid,
      sourceRowNumber0: 10,
      entityName0: 'Entity One',
      glMonth0: '2024-01',
      sourceRowNumber1: 11,
    });

    expect(insertedRecords[0]).toEqual(
      expect.objectContaining({
        fileUploadId: guid,
        fileUploadGuid: guid,
        insertedDttm: inserted.toISOString(),
        sourceRowNumber: 10,
        entityName: 'Entity One',
      }),
    );
  });

  it('retrieves file records by GUID', async () => {
    const insertedDttm = new Date('2024-01-02T00:00:00.000Z');
    mockedRunQuery.mockResolvedValue({
      recordset: [
        {
          file_upload_guid: guid,
          record_id: 20,
          source_sheet_name: 'Sheet1',
          source_row_number: 3,
          entity_id: 'ent-1',
          entity_name: 'Entity One',
          account_id: '300',
          account_name: 'Equity',
          opening_balance: 0,
          closing_balance: 100,
          activity_amount: 100,
          gl_month: '2024-02',
          user_defined1: 'U1',
          user_defined2: 2,
          user_defined3: 'U3',
          inserted_dttm: insertedDttm,
        },
      ],
    } as any);

    const results = await listFileRecords(guid);

    const [sql, params] = mockedRunQuery.mock.calls[0];
    expect(sql).toContain('FILE_UPLOAD_GUID = @fileUploadGuid');
    expect(params).toEqual({ fileUploadGuid: guid });

    expect(results[0]).toEqual({
      fileUploadId: guid,
      fileUploadGuid: guid,
      recordId: 20,
      sourceSheet: 'Sheet1',
      sourceRowNumber: 3,
      entityId: 'ent-1',
      entityName: 'Entity One',
      accountId: '300',
      accountName: 'Equity',
      openingBalance: 0,
      closingBalance: 100,
      activityAmount: 100,
      glMonth: '2024-02',
      userDefined1: 'U1',
      userDefined2: '2',
      userDefined3: 'U3',
      insertedDttm: insertedDttm.toISOString(),
    });
  });
});
