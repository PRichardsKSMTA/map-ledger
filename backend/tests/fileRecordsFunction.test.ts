jest.mock('../src/repositories/fileRecordRepository', () => ({
  insertFileRecords: jest.fn(),
  listFileRecords: jest.fn(),
}));

jest.mock('../src/repositories/clientFileRepository', () => ({
  findFileUploadIdByGuid: jest.fn(),
}));

import { ingestFileRecordsHandler } from '../src/functions/fileRecords';
import { insertFileRecords } from '../src/repositories/fileRecordRepository';
import { findFileUploadIdByGuid } from '../src/repositories/clientFileRepository';

const basePayload = {
  fileUploadGuid: 'guid-123',
  headerMap: {
    'GL ID': 'Account ID',
    'Account Description': 'Account Name',
    NetChange: 'Amount',
  },
  sheets: [
    {
      sheetName: 'Sheet1',
      rows: [
        {
          'Account ID': '100',
          'Account Name': 'Cash',
          Amount: 25,
        },
      ],
    },
  ],
};

describe('fileRecords.ingestFileRecordsHandler', () => {
  const mockInsertFileRecords = insertFileRecords as jest.MockedFunction<typeof insertFileRecords>;
  const mockFindFileUploadIdByGuid =
    findFileUploadIdByGuid as jest.MockedFunction<typeof findFileUploadIdByGuid>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves file upload GUIDs before ingesting records', async () => {
    mockFindFileUploadIdByGuid.mockResolvedValue(42);
    mockInsertFileRecords.mockResolvedValue([
      {
        recordId: 1,
        fileUploadId: 42,
        accountId: '100',
        accountName: 'Cash',
        activityAmount: 25,
      },
    ]);

    const request = { json: jest.fn().mockResolvedValue(basePayload) } as any;
    const context = { warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

    const response = await ingestFileRecordsHandler(request, context);

    expect(mockFindFileUploadIdByGuid).toHaveBeenCalledWith('guid-123');
    expect(mockInsertFileRecords).toHaveBeenCalledWith(42, expect.any(Array));
    expect(response.status).toBe(201);
  });

  it('rejects requests when the GUID cannot be resolved', async () => {
    mockFindFileUploadIdByGuid.mockResolvedValue(null);

    const request = { json: jest.fn().mockResolvedValue(basePayload) } as any;
    const context = { warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

    const response = await ingestFileRecordsHandler(request, context);

    expect(response.status).toBe(400);
    expect(mockInsertFileRecords).not.toHaveBeenCalled();
  });
});
