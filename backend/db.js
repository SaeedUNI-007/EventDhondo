// db.js
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,             // Added process.env.
    password: process.env.DB_PASSWORD,     // Added process.env.
    server: process.env.DB_SERVER,         // Added process.env.
    database: process.env.DB_DATABASE,     // Added process.env.
    options: { 
        encrypt: false, 
        trustServerCertificate: true 
    },
    // DB port is separate from the Express app port.
    port: Number(process.env.DB_PORT) || 1433
};

// Create a connection pool and export it
const poolPromise = sql.connect(dbConfig)
    .then(async (pool) => {
        if (pool.connected) {
            console.log('✅ Connected to SQL Server Successfully!');
            try {
                const info = await pool.request().query('SELECT DB_NAME() AS CurrentDatabase, @@SERVERNAME AS ServerName');
                const row = info.recordset?.[0] || {};
                console.log(`🧭 SQL Context -> Server: ${row.ServerName || dbConfig.server}, Database: ${row.CurrentDatabase || dbConfig.database}`);
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