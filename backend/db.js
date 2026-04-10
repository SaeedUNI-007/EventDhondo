// db.js

const useWinAuth = (process.env.USE_WIN_AUTH || 'false').toLowerCase() === 'true';
const sql = useWinAuth ? require('mssql/msnodesqlv8') : require('mssql');

const parseBool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value).toLowerCase() === 'true';
};

const config = useWinAuth
  ? {
      // prefer an explicit ODBC driver name — change to "ODBC Driver 17..." if you installed v17
      connectionString:
        process.env.DB_CONNECTION_STRING ||
        `Driver={ODBC Driver 18 for SQL Server};Server=${process.env.DB_SERVER_HOST || 'localhost'}\\${process.env.DB_INSTANCE || 'SQLEXPRESS'};Database=${process.env.DB_DATABASE || 'EventDhondo'};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_DATABASE,
            options: {
                enableArithAbort: true,
                // Modern SQL drivers default encrypt=true. For local SQL Server with
                // self-signed certificates, trustServerCertificate must be enabled.
                encrypt: parseBool(process.env.DB_ENCRYPT, true),
                trustServerCertificate: parseBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true)
            },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
    };


// Create a connection pool and export it
const poolPromise = sql.connect(config)
    .then(async (pool) => {
        if (pool.connected) {
            console.log('✅ Connected to SQL Server Successfully!');
            try {
                const info = await pool.request().query('SELECT DB_NAME() AS CurrentDatabase, @@SERVERNAME AS ServerName');
                const row = info.recordset?.[0] || {};
                console.log(`🧭 SQL Context -> Server: ${row.ServerName || config.server}, Database: ${row.CurrentDatabase || config.database}`);
            } catch (metaErr) {
                console.warn('⚠️ Connected, but could not read SQL context metadata.');
            }
        }
        return pool;
    })
    .catch(err => {
        console.error('❌ Database Connection Failed!', err);
        process.exit(1); // Stop the server if the DB fails to connect
    });

module.exports = { sql, poolPromise };