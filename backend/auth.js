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
        role,
        studentProfile,
        organizerProfile,
        interests,
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();

    const normalizedRole = String(role || 'student').toLowerCase();
    const isOrganizer = normalizedRole === 'organizer';

    const fullName = String(name || '').trim();
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const studentFirstName = String(firstNameRaw || studentProfile?.firstName || nameParts[0] || '').trim();
    const studentLastName = String(lastNameRaw || studentProfile?.lastName || nameParts.slice(1).join(' ') || 'N/A').trim();
    const studentDepartment = String(departmentId || department || studentProfile?.department || '').trim() || null;
    const parsedYear = Number(yearOfStudy ?? year ?? studentProfile?.yearOfStudy);
    const studentDateOfBirthRaw = studentProfile?.dateOfBirth || null;
    const studentDateOfBirth = studentDateOfBirthRaw ? new Date(studentDateOfBirthRaw) : null;
    const studentProfilePicture = studentProfile?.profilePictureURL || null;

    const orgName = String(organizerProfile?.organizationName || '').trim();
    const orgDescription = String(organizerProfile?.description || '').trim() || null;
    const orgContactEmail = String(organizerProfile?.contactEmail || '').trim();
    const orgProfilePicture = organizerProfile?.profilePictureURL || null;

    if (!normalizedEmail || !password) {
        return res.status(400).json({
            success: false,
            message: 'email and password are required',
        });
    }

    if (!isOrganizer) {
        if (!studentFirstName) {
            return res.status(400).json({
                success: false,
                message: 'firstName is required for student registration',
            });
        }

        if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 8) {
            return res.status(400).json({
                success: false,
                message: 'yearOfStudy must be between 1 and 8',
            });
        }

        if (studentDateOfBirthRaw && Number.isNaN(studentDateOfBirth?.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'dateOfBirth is not a valid date',
            });
        }
    } else if (!orgName || !orgContactEmail) {
        return res.status(400).json({
            success: false,
            message: 'organizationName and contactEmail are required for organizer registration',
        });
    }

    // Validation: Only allow @edu.pk
    if (!isUniversityEmail(normalizedEmail)) {
        return res.status(400).json({ 
            success: false, 
            message: "Registration is only allowed for users with an @fast.edu.pk email." 
        });
    }

    try {
        const pool = await poolPromise;

        const existingUser = await pool.request()
            .input('Email', sql.NVarChar(100), normalizedEmail)
            .query('SELECT TOP 1 UserID FROM Users WHERE Email = @Email');

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {
            const userInsert = await new sql.Request(transaction)
                .input('Email', sql.NVarChar(100), normalizedEmail)
                .input('PasswordHash', sql.NVarChar(255), hashedPassword)
                .input('Role', sql.NVarChar(10), isOrganizer ? 'Organizer' : 'Student')
                .input('VerificationStatus', sql.NVarChar(10), isOrganizer ? 'Pending' : 'Verified')
                .query(`
                    INSERT INTO Users (Email, PasswordHash, Role, VerificationStatus)
                    OUTPUT INSERTED.UserID
                    VALUES (@Email, @PasswordHash, @Role, @VerificationStatus)
                `);

            const newUserId = userInsert.recordset?.[0]?.UserID;

            if (isOrganizer) {
                await new sql.Request(transaction)
                    .input('UserID', sql.Int, newUserId)
                    .input('OrganizationName', sql.NVarChar(150), orgName)
                    .input('Description', sql.NVarChar(sql.MAX), orgDescription)
                    .input('ContactEmail', sql.NVarChar(100), orgContactEmail)
                    .input('ProfilePictureURL', sql.NVarChar(sql.MAX), orgProfilePicture)
                    .query(`
                        INSERT INTO OrganizerProfiles (UserID, OrganizationName, Description, ContactEmail, ProfilePictureURL, VerificationStatus)
                        VALUES (@UserID, @OrganizationName, @Description, @ContactEmail, @ProfilePictureURL, 'Pending')
                    `);
            } else {
                await new sql.Request(transaction)
                    .input('UserID', sql.Int, newUserId)
                    .input('FirstName', sql.NVarChar(50), studentFirstName)
                    .input('LastName', sql.NVarChar(50), studentLastName)
                    .input('Department', sql.NVarChar(100), studentDepartment)
                    .input('YearOfStudy', sql.Int, parsedYear)
                    .input('DateOfBirth', sql.Date, studentDateOfBirthRaw ? studentDateOfBirth : null)
                    .input('ProfilePictureURL', sql.NVarChar(sql.MAX), studentProfilePicture)
                    .query(`
                        INSERT INTO StudentProfiles (UserID, FirstName, LastName, Department, YearOfStudy, DateOfBirth, ProfilePictureURL)
                        VALUES (@UserID, @FirstName, @LastName, @Department, @YearOfStudy, @DateOfBirth, @ProfilePictureURL)
                    `);
            }

            if (Array.isArray(interests) && interests.length > 0) {
                const normalizedInterestNames = Array.from(new Set(
                    interests
                        .map((name) => String(name || '').trim())
                        .filter(Boolean)
                ));

                if (normalizedInterestNames.length > 0) {
                    const availableResult = await new sql.Request(transaction)
                        .query('SELECT InterestID, InterestName FROM Interests');

                    const interestNameToId = new Map();
                    for (const row of availableResult.recordset || []) {
                        const key = String(row.InterestName || '').trim().toLowerCase();
                        if (key && !interestNameToId.has(key)) {
                            interestNameToId.set(key, row.InterestID);
                        }
                    }

                    const missingInterests = [];

                    for (const selectedName of normalizedInterestNames) {
                        const interestId = interestNameToId.get(selectedName.toLowerCase());

                        if (interestId === undefined || interestId === null) {
                            missingInterests.push(selectedName);
                            continue;
                        }

                        await new sql.Request(transaction)
                            .input('UserID', sql.Int, newUserId)
                            .input('InterestID', sql.Int, interestId)
                            .query(`
                                IF NOT EXISTS (SELECT 1 FROM UserInterests WHERE UserID = @UserID AND InterestID = @InterestID)
                                BEGIN
                                    INSERT INTO UserInterests (UserID, InterestID)
                                    VALUES (@UserID, @InterestID)
                                END
                            `);
                    }

                    if (missingInterests.length > 0) {
                        throw new Error(`Unknown interests selected: ${missingInterests.join(', ')}`);
                    }
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
        res.status(201).json({
            success: true,
            message: isOrganizer ? 'Organizer registered successfully!' : 'Student registered successfully!',
        });
    } catch (err) {
        console.error("Registration Error:", err);
        if (err.number === 2627 || err.number === 2601) {
            const errMsg = String(err.message || '').toLowerCase();
            if (errMsg.includes('organizationname')) {
                return res.status(409).json({ success: false, message: 'Organization name already exists' });
            }
            if (errMsg.includes('email')) {
                return res.status(409).json({ success: false, message: 'Email already exists' });
            }
            return res.status(409).json({ success: false, message: 'Duplicate value violates a unique constraint' });
        }
        res.status(500).json({ success: false, message: err.message || 'Registration failed' });
    }
});

// 2. POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    // Validation: Only allow @edu.pk
    if (!isUniversityEmail(normalizedEmail)) {
        return res.status(400).json({ 
            success: false, 
            message: "Access is restricted to @fast.edu.pk email addresses." 
        });
    }

    try {
        const pool = await poolPromise;
        
        const result = await pool.request()
            .input('Email', sql.NVarChar, normalizedEmail)
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