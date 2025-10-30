import sql, { ConnectionPool, config as SqlConfig, IResult } from 'mssql';

let connectionPromise: Promise<ConnectionPool> | null = null;

const resolveSqlConfig = (): SqlConfig => {
  const connectionString =
    process.env.SQL_CONN_STR ||
    process.env.SQL_CONNECTION_STRING ||
    process.env.SQL_CONN_STRINGS ||
    process.env.SQL_CONN_STRING;

  if (connectionString) {
    return {
      connectionString,
    } satisfies SqlConfig;
  }

  const server = process.env.SQL_SERVER;
  const database = process.env.SQL_DATABASE;
  const user = process.env.SQL_USERNAME || process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const driver = process.env.SQL_DRIVER;

  if (server && database && user && password) {
    return {
      server,
      database,
      user,
      password,
      driver,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    } satisfies SqlConfig;
  }

  throw new Error(
    'Missing SQL connection configuration. Set SQL_CONN_STR or SQL_SERVER/SQL_DATABASE/SQL_USERNAME/SQL_PASSWORD.'
  );
};

export const getSqlPool = async (): Promise<ConnectionPool> => {
  if (!connectionPromise) {
    const config = resolveSqlConfig();
    connectionPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool: ConnectionPool) => {
        pool.on('error', (err: Error) => {
          // eslint-disable-next-line no-console
          console.error('SQL connection pool error', err);
          connectionPromise = null;
        });
        return pool;
      })
      .catch((error: unknown) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
};

export const runQuery = async <TRecord = Record<string, unknown>>(
  query: string,
  parameters: Record<string, unknown> = {}
): Promise<IResult<TRecord>> => {
  const pool = await getSqlPool();
  const request = pool.request();

  Object.entries(parameters).forEach(([key, value]) => {
    request.input(key, value ?? null);
  });

  return request.query<TRecord>(query);
};

export default sql;
