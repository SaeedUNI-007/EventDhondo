const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Basic Route
app.get('/', (req, res) => {
    res.send('EventDhondo Backend is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});