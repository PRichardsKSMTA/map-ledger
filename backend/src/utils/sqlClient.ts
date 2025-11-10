import sql, { ConnectionPool, config as SqlConfig, IResult } from 'mssql';

const logPrefix = '[sqlClient]';

const shouldLog = process.env.NODE_ENV !== 'test';

const logDebug = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(logPrefix, ...args);
};

const logInfo = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(logPrefix, ...args);
};

const logError = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, ...args);
};

let connectionPromise: Promise<ConnectionPool> | null = null;

const toBool = (v?: string) => (typeof v === 'string' ? v.toLowerCase() === 'true' : false);
const toInt = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toOptionalBool = (value?: string): boolean | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalised = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalised)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalised)) {
    return false;
  }
  return undefined;
};

const normaliseKey = (key: string) => key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const parseKeyValueConnectionString = (connectionString: string) => {
  const segments = connectionString
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const result: Record<string, string> = {};
  segments.forEach((segment) => {
    const [rawKey, ...rawValueParts] = segment.split('=');
    if (!rawKey || rawValueParts.length === 0) {
      return;
    }
    const value = rawValueParts.join('=').trim();
    const key = normaliseKey(rawKey);
    if (!key) {
      return;
    }
    result[key] = value.replace(/^{|}$/g, '');
  });
  return result;
};

const parseSqlConfigFromConnectionString = (
  connectionString: string,
  defaults: { encrypt: boolean; trustServerCertificate: boolean },
): SqlConfig | null => {
  if (!connectionString.includes('=')) {
    return null;
  }

  const kv = parseKeyValueConnectionString(connectionString);
  if (!Object.keys(kv).length) {
    return null;
  }

  const server =
    kv.SERVER ||
    kv.DATASOURCE ||
    kv.ADDR ||
    kv.ADDRESS ||
    kv.NETWORKADDRESS ||
    kv.HOSTNAME ||
    kv.HOST;
  const database = kv.DATABASE || kv.INITIALCATALOG;
  const user = kv.UID || kv.USER || kv.USERID || kv.USERNAME || kv.LOGIN;
  const password = kv.PWD || kv.PASSWORD;

  if (!server || !database) {
    return null;
  }

  const port = Number(kv.PORT || kv.PORTNUMBER);
  const encrypt = toOptionalBool(kv.ENCRYPT);
  const trust =
    toOptionalBool(kv.TRUSTSERVERCERTIFICATE) ||
    toOptionalBool(kv.TRUSTEDCONNECTION) ||
    toOptionalBool(kv.TRUSTSERVERCERT) ||
    toOptionalBool(kv.TRUSTCERTIFICATE);

  const options = {
    encrypt: encrypt ?? defaults.encrypt,
    trustServerCertificate: trust ?? defaults.trustServerCertificate,
    enableArithAbort: true,
  };

  const pool = {
    max: toInt(process.env.SQL_POOL_MAX, 10),
    min: toInt(process.env.SQL_POOL_MIN, 0),
    idleTimeoutMillis: toInt(process.env.SQL_POOL_IDLE_TIMEOUT, 30000),
  };

  const config: SqlConfig = {
    server,
    database,
    user,
    password,
    options,
    pool,
  };

  if (Number.isFinite(port)) {
    (config as SqlConfig & { port?: number }).port = port;
  }

  return config;
};

const resolveSqlConfig = (): SqlConfig => {
  const cs =
    process.env.SQL_CONN_STR ||
    process.env.SQL_CONNECTION_STRING ||
    process.env.SQL_CONN_STRINGS ||
    process.env.SQL_CONN_STRING;

  const encrypt = toBool(process.env.SQL_ENCRYPT ?? 'true');
  const trust = toBool(process.env.SQL_TRUST_CERT);

  if (cs) {
    logInfo('Resolved SQL configuration from connection string');
    logInfo('Using SQL connection string from environment', {
      connectionString: cs,
    });

    const parsed = parseSqlConfigFromConnectionString(cs, {
      encrypt,
      trustServerCertificate: trust,
    });

    if (parsed) {
      logInfo('Parsed SQL connection string into discrete configuration', {
        server: parsed.server,
        database: parsed.database,
        hasUser: Boolean(parsed.user),
        hasPassword: Boolean(parsed.password),
        encrypt: parsed.options?.encrypt,
        trustServerCertificate: parsed.options?.trustServerCertificate,
      });
      return parsed;
    }

    return {
      connectionString: cs,
      options: { encrypt, trustServerCertificate: trust, enableArithAbort: true },
      pool: {
        max: toInt(process.env.SQL_POOL_MAX, 10),
        min: toInt(process.env.SQL_POOL_MIN, 0),
        idleTimeoutMillis: toInt(process.env.SQL_POOL_IDLE_TIMEOUT, 30000),
      },
    } as SqlConfig;
  }

  const { SQL_SERVER: server, SQL_DATABASE: database, SQL_USERNAME: user, SQL_PASSWORD: password } = process.env as Record<string,string>;
  if (!server || !database || !user || !password) {
    throw new Error('Missing SQL env vars. Provide SQL_CONN_STR or (SQL_SERVER, SQL_DATABASE, SQL_USERNAME, SQL_PASSWORD).');
  }
  logInfo('Resolved SQL configuration from discrete environment variables', {
    server,
    database,
    hasUser: Boolean(user),
    hasPassword: Boolean(password),
    encrypt,
    trustServerCertificate: trust,
  });

  return {
    server, database, user, password,
    options: { encrypt, trustServerCertificate: trust, enableArithAbort: true },
    pool: { max: toInt(process.env.SQL_POOL_MAX, 10), min: toInt(process.env.SQL_POOL_MIN, 0), idleTimeoutMillis: toInt(process.env.SQL_POOL_IDLE_TIMEOUT, 30000) }
  } as SqlConfig;
};

export const getSqlPool = async (): Promise<ConnectionPool> => {
  if (!connectionPromise) {
    const cfg = resolveSqlConfig();
    const startTime = Date.now();
    const connectionString = (cfg as { connectionString?: string }).connectionString;
    const server = (cfg as { server?: string }).server;
    const database = (cfg as { database?: string }).database;
    logInfo('Establishing new SQL connection pool', {
      hasConnectionString: Boolean(connectionString),
      server,
      database,
      poolMax: cfg.pool?.max,
      poolMin: cfg.pool?.min,
      idleTimeoutMillis: cfg.pool?.idleTimeoutMillis,
    });

    if (connectionString) {
      logInfo('Attempting SQL connection with connection string', {
        connectionString,
      });
    } else {
      logInfo('Attempting SQL connection with discrete configuration', {
        server,
        database,
      });
    }

    connectionPromise = new sql.ConnectionPool(cfg)
      .connect()
      .then((pool) => {
        const durationMs = Date.now() - startTime;
        logInfo('SQL connection pool established', { durationMs });
        if (connectionString) {
          logInfo('SQL connection established using connection string', {
            connectionString,
          });
        } else {
          logInfo('SQL connection established using discrete configuration', {
            server,
            database,
          });
        }
        pool.on('error', (err) => {
          logError('SQL connection pool encountered an error', err);
          connectionPromise = null;
        });
        return pool;
      })
      .catch((error) => {
        connectionPromise = null;
        logError('Failed to establish SQL connection pool', error);
        throw error;
      });
  } else {
    logDebug('Reusing existing SQL connection pool promise');
  }
  return connectionPromise;
};

export const runQuery = async <TRecord = Record<string, unknown>>(query: string, parameters: Record<string, unknown> = {}): Promise<IResult<TRecord>> => {
  const pool = await getSqlPool();
  const request = pool.request();
  Object.entries(parameters).forEach(([name, value]) => {
    request.input(name, value as any);
  });

  logInfo('Executing SQL query', {
    query,
    parameters,
  });

  const startTime = Date.now();
  try {
    const result = await request.query<TRecord>(query);
    const durationMs = Date.now() - startTime;
    logInfo('SQL query executed successfully', {
      durationMs,
      rowCount: result.recordset?.length ?? 0,
    });
    if (result.recordset && result.recordset.length > 0) {
      logDebug('SQL query result sample', {
        firstRow: result.recordset[0],
      });
    } else {
      logDebug('SQL query returned no rows');
    }
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logError('SQL query failed', {
      durationMs,
      query,
      parameters,
      error,
    });
    throw error;
  }
};

export default { getSqlPool, runQuery };