// db.js
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,             // Added process.env.
    password: process.env.DB_PASSWORD,     // Added process.env.
    server: process.env.DB_SERVER,         // Added process.env.
    database: process.env.DB_DATABASE,     // Added process.env.
    options: {
        instanceName: 'SQLEXPRESS', 
        encrypt: false, 
        trustServerCertificate: true 
    },
    // DB port is separate from the Express app port.
    port: Number(process.env.DB_PORT) || 1433
};

// Create a connection pool and export it
const poolPromise = sql.connect(dbConfig)
    .then(pool => {
        if (pool.connected) {
            console.log('✅ Connected to SQL Server Successfully!');
        }
        return pool;
    })
    .catch(err => {
        console.error('❌ Database Connection Failed!', err);
        process.exit(1); // Stop the server if the DB fails to connect
    });

module.exports = { sql, poolPromise };