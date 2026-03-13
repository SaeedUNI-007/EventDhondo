// routes/auth.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const bcrypt = require('bcrypt');

// Helper function to validate the university domain
const isUniversityEmail = (email) => {
    return email && email.toLowerCase().endsWith('@fast.edu.pk');
};

// 1. POST /api/auth/register
router.post('/register', async (req, res) => {
    const {
        email,
        password,
        name,
        firstName: firstNameRaw,
        lastName: lastNameRaw,
        department,
        departmentId,
        year,
        yearOfStudy,
    } = req.body;

    const fullName = String(name || '').trim();
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName = (firstNameRaw || nameParts[0] || '').trim();
    const lastName = (lastNameRaw || nameParts.slice(1).join(' ') || 'N/A').trim();
    const finalDepartment = (departmentId || department || null);
    const parsedYear = Number(yearOfStudy ?? year);

    if (!email || !password || !firstName) {
        return res.status(400).json({
            success: false,
            message: 'email, password and student name are required',
        });
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 4) {
        return res.status(400).json({
            success: false,
            message: 'yearOfStudy must be between 1 and 4 for BS degree',
        });
    }

    // Validation: Only allow @edu.pk
    if (!isUniversityEmail(email)) {
        return res.status(400).json({ 
            success: false, 
            message: "Registration is only allowed for users with an @fast.edu.pk email." 
        });
    }

    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash(password, 10);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {
            const userInsert = await new sql.Request(transaction)
                .input('Email', sql.NVarChar(100), email)
                .input('PasswordHash', sql.NVarChar(255), hashedPassword)
                .query(`
                    INSERT INTO Users (Email, PasswordHash, Role, VerificationStatus)
                    OUTPUT INSERTED.UserID
                    VALUES (@Email, @PasswordHash, 'Student', 'Verified')
                `);

            const newUserId = userInsert.recordset?.[0]?.UserID;

            await new sql.Request(transaction)
                .input('UserID', sql.Int, newUserId)
                .input('FirstName', sql.NVarChar(50), firstName)
                .input('LastName', sql.NVarChar(50), lastName)
                .input('Department', sql.NVarChar(100), finalDepartment)
                .input('YearOfStudy', sql.Int, parsedYear)
                .query(`
                    INSERT INTO StudentProfiles (UserID, FirstName, LastName, Department, YearOfStudy)
                    VALUES (@UserID, @FirstName, @LastName, @Department, @YearOfStudy)
                `);

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
        res.status(201).json({ success: true, message: "Student registered successfully!" });
    } catch (err) {
        console.error("Registration Error:", err);
        if (err.number === 2627 || err.number === 2601) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }
        res.status(500).json({ success: false, message: err.message || 'Registration failed' });
    }
});

// 2. POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    // Validation: Only allow @edu.pk
    if (!isUniversityEmail(email)) {
        return res.status(400).json({ 
            success: false, 
            message: "Access is restricted to @fast.edu.pk email addresses." 
        });
    }

    try {
        const pool = await poolPromise;
        
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT UserID, Role, PasswordHash FROM Users WHERE Email = @Email');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            const stored = user.PasswordHash || '';
            const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(stored);
            const isPasswordValid = isBcryptHash
                ? await bcrypt.compare(password, stored)
                : password === stored; // Temporary fallback for legacy plaintext rows

            if (isPasswordValid) {
                res.status(200).json({ 
                    success: true, 
                    userId: user.UserID, 
                    role: user.Role 
                });
            } else {
                res.status(401).json({ success: false, message: "Invalid email or password" });
            }
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password" });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, message: "Server Error during login" });
    }
});

module.exports = router;