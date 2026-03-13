// routes/auth.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db'); // Adjust path to your db connection
const bcrypt = require('bcrypt');

// Task 1: POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        // Extracting data sent by frontend
        const { name, email, password, departmentId, yearOfStudy } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'name, email and password are required' });
        }

        const nameParts = String(name).trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || 'N/A';
        const department = departmentId ? String(departmentId) : null;
        const parsedYear = Number(yearOfStudy);
        if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 4) {
            return res.status(400).json({ success: false, message: 'yearOfStudy must be between 1 and 4 for BS degree' });
        }
        const finalYearOfStudy = parsedYear;
        
        const pool = await poolPromise;
        const request = pool.request();

        const hashedPassword = await bcrypt.hash(password, 10);

        // Bind parameters to match sp_RegisterStudent
        request.input('Email', sql.NVarChar(100), email);
        request.input('PasswordHash', sql.NVarChar(255), hashedPassword);
        request.input('FirstName', sql.NVarChar(50), firstName);
        request.input('LastName', sql.NVarChar(50), lastName);
        request.input('Department', sql.NVarChar(100), department);
        request.input('YearOfStudy', sql.Int, finalYearOfStudy);
        
        // Execute procedure
        const result = await request.execute('sp_RegisterStudent');
        
        res.status(201).json({ 
            success: true, 
            message: "Student registered successfully!",
            data: result.recordset?.[0] || null
        });

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ success: false, message: "Server Error during registration", error: err.message });
    }
});

// Task 3: POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required' });
        }

        const pool = await poolPromise;

        // Load stored hash by email, then compare with bcrypt.
        const result = await pool.request()
            .input('Email', sql.NVarChar(100), email)
            .query('SELECT UserID, Role, PasswordHash FROM Users WHERE Email = @Email');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            const isMatch = await bcrypt.compare(password, user.PasswordHash);

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }

            // Returning UserID so Frontend Dev can save it to localStorage (Task 2 for Frontend)
            res.status(200).json({ 
                success: true, 
                message: "Login successful", 
                userId: user.UserID,
                role: user.Role
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password" });
        }
    } catch (err) {
        console.error("DEBUG LOGIN ERROR:", err);
        res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
});

module.exports = router;