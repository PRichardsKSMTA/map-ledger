jest.mock('../src/utils/sqlClient', () => ({
  runQuery: jest.fn(),
}));

import { runQuery } from '../src/utils/sqlClient';
import { fetchUserClientAccess } from '../src/repositories/userClientRepository';

type RunQueryMock = jest.MockedFunction<typeof runQuery>;

const ORIGINAL_ENV = process.env;

const configureEnv = (overrides: Record<string, string>) => {
  process.env = {
    ...ORIGINAL_ENV,
    ...overrides,
  } as NodeJS.ProcessEnv;
};

describe('fetchUserClientAccess', () => {
  let mockedRunQuery: RunQueryMock;

  beforeEach(() => {
    mockedRunQuery = runQuery as RunQueryMock;
    mockedRunQuery.mockReset();
    configureEnv({
      SQL_CONN_STR: 'Server=fake;Database=fake;User Id=fake;Password=fake;',
      NODE_ENV: 'test',
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns ordered client operations with operation codes', async () => {
    mockedRunQuery
      .mockResolvedValueOnce({
        recordset: [
          {
            CLIENT_ID: 'C1',
            CLIENT_NAME: 'Client Alpha',
            CLIENT_SCAC: 'ALPH',
            OPERATIONAL_SCAC: 'AL1',
            OPERATION_CD: 'OPS-001',
            OPERATION_NAME: 'Linehaul',
          },
          {
            CLIENT_ID: 'C1',
            CLIENT_NAME: 'Client Alpha',
            CLIENT_SCAC: 'ALPH',
            OPERATIONAL_SCAC: 'AL1',
            OPERATION_CD: 'OPS-002',
            OPERATION_NAME: null,
          },
          {
            CLIENT_ID: 'C1',
            CLIENT_NAME: 'Client Alpha',
            CLIENT_SCAC: 'ALPH',
            OPERATIONAL_SCAC: 'AL2',
            OPERATION_CD: 'OPS-003',
            OPERATION_NAME: 'Dedicated',
          },
          {
            CLIENT_ID: 'C2',
            CLIENT_NAME: 'Client Beta',
            CLIENT_SCAC: 'BETA',
            OPERATIONAL_SCAC: 'BE1',
            OPERATION_CD: 'OPS-010',
            OPERATION_NAME: 'International',
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        recordset: [
          { client_id: 'C1', total_accounts: 5, mapped_accounts: 3 },
          { client_id: 'C2', total_accounts: 1, mapped_accounts: 1 },
        ],
      } as any);

    const result = await fetchUserClientAccess('User@Example.com');

    expect(mockedRunQuery).toHaveBeenCalledWith(
      expect.stringContaining('ML.V_CLIENT_OPERATIONS'),
      {}
    );
    expect(result.userEmail).toBe('user@example.com');
    expect(result.userName).toBeNull();
    expect(result.clients).toHaveLength(2);

    const [alpha, beta] = result.clients;
    expect(alpha.clientId).toBe('C1');
    expect(alpha.clientScac).toBe('ALPH');
    expect(alpha.companies.map((company) => company.companyId)).toEqual([
      'AL1',
      'AL2',
    ]);

    const alphaOperations = alpha.companies[0]?.operations ?? [];
    expect(alphaOperations).toEqual([
      { id: 'OPS-001', code: 'OPS-001', name: 'Linehaul' },
      { id: 'OPS-002', code: 'OPS-002', name: 'OPS-002' },
    ]);

    const betaOperations = beta.companies[0]?.operations ?? [];
    expect(betaOperations[0]).toEqual({
      id: 'OPS-010',
      code: 'OPS-010',
      name: 'International',
    });
    expect(beta.clientScac).toBe('BETA');
  });

  it('returns an empty client list when no SQL rows are returned', async () => {
    mockedRunQuery.mockResolvedValueOnce({ recordset: [] } as any);

    const result = await fetchUserClientAccess('user@example.com');

    expect(result.userEmail).toBe('user@example.com');
    expect(result.userName).toBeNull();
    expect(result.clients).toEqual([]);
  });

  it('throws an error when the SQL query fails', async () => {
    mockedRunQuery.mockRejectedValue(new Error('SQL unavailable'));

    await expect(fetchUserClientAccess('user@example.com')).rejects.toThrow(
      'SQL unavailable'
    );
  });
});
