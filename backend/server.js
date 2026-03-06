const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. DATABASE CONFIGURATION
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
    port: 1433
};

// 2. CONNECT TO THE DATABASE
sql.connect(dbConfig)
    .then(pool => {
        if (pool.connected) {
            console.log('✅ Connected to SQL Server Successfully!');
        }
    })
    .catch(err => {
        console.error('❌ Database Connection Failed!', err);
    });

// 3. TEST ROUTE: GET ALL USERS (To prove it works)
app.get('/api/users', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM Users`;
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. TEST ROUTE: HELLO WORLD
app.get('/', (req, res) => {
    res.send('EventDhondo Backend is Live!');
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});