jest.mock('../src/repositories/fileRecordRepository', () => ({
  insertFileRecords: jest.fn(),
  listFileRecords: jest.fn(),
}));

jest.mock('../src/repositories/clientFileRepository', () => ({
  findFileUploadIdByGuid: jest.fn(),
  findFileUploadGuidById: jest.fn(),
}));

import { ingestFileRecordsHandler } from '../src/functions/fileRecords';
import { insertFileRecords } from '../src/repositories/fileRecordRepository';
import { findFileUploadGuidById, findFileUploadIdByGuid } from '../src/repositories/clientFileRepository';

const basePayload = {
  fileUploadGuid: '12345678-1234-1234-1234-1234567890ab',
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
  const mockFindFileUploadGuidById =
    findFileUploadGuidById as jest.MockedFunction<typeof findFileUploadGuidById>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves file upload GUIDs before ingesting records', async () => {
    mockFindFileUploadIdByGuid.mockResolvedValue(42);
    mockFindFileUploadGuidById.mockResolvedValue(basePayload.fileUploadGuid);
    mockInsertFileRecords.mockResolvedValue([
      {
        recordId: 1,
        fileUploadId: 42,
        fileUploadGuid: basePayload.fileUploadGuid,
        accountId: '100',
        accountName: 'Cash',
        activityAmount: 25,
      },
    ]);

    const request = { json: jest.fn().mockResolvedValue(basePayload) } as any;
    const context = { warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

    const response = await ingestFileRecordsHandler(request, context);

    expect(mockFindFileUploadIdByGuid).toHaveBeenCalledWith(basePayload.fileUploadGuid);
    expect(mockInsertFileRecords).toHaveBeenCalledWith(
      42,
      basePayload.fileUploadGuid,
      expect.any(Array),
    );
    expect(response.status).toBe(201);
  });

  it('rejects requests when the GUID cannot be resolved', async () => {
    mockFindFileUploadIdByGuid.mockResolvedValue(null);
    mockFindFileUploadGuidById.mockResolvedValue(null);

    const request = { json: jest.fn().mockResolvedValue(basePayload) } as any;
    const context = { warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

    const response = await ingestFileRecordsHandler(request, context);

    expect(response.status).toBe(400);
    expect(mockInsertFileRecords).not.toHaveBeenCalled();
  });

  it('looks up file upload GUIDs by ID when GUID is not supplied', async () => {
    mockFindFileUploadIdByGuid.mockResolvedValue(null);
    mockFindFileUploadGuidById.mockResolvedValue(basePayload.fileUploadGuid);
    mockInsertFileRecords.mockResolvedValue([
      {
        recordId: 1,
        fileUploadId: 84,
        fileUploadGuid: basePayload.fileUploadGuid,
        accountId: '100',
        accountName: 'Cash',
        activityAmount: 25,
      },
    ]);

    const request = { json: jest.fn().mockResolvedValue({ ...basePayload, fileUploadId: 84, fileUploadGuid: undefined }) } as any;
    const context = { warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

    const response = await ingestFileRecordsHandler(request, context);

    expect(mockFindFileUploadGuidById).toHaveBeenCalledWith(84);
    expect(mockInsertFileRecords).toHaveBeenCalledWith(84, basePayload.fileUploadGuid, expect.any(Array));
    expect(response.status).toBe(201);
  });
});
