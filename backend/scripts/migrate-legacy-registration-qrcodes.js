const crypto = require('crypto');
const { sql, poolPromise } = require('../db');

const buildStudentQrToken = (userId) => {
    const secret = process.env.QR_SECRET || process.env.JWT_SECRET || 'eventdhondo-qr-secret';
    const normalizedUserId = String(Number(userId));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(normalizedUserId)
        .digest('hex')
        .slice(0, 20);
    return `EDUQR:${normalizedUserId}:${signature}`;
};

(async () => {
    const pool = await poolPromise;

    const uq = await pool.request().query(`
        SELECT TOP 1 kc.name AS ConstraintName
        FROM sys.key_constraints kc
        JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        JOIN sys.tables t ON kc.parent_object_id = t.object_id
        WHERE kc.type = 'UQ' AND t.name = 'Registrations' AND c.name = 'QRCode'
    `);

    const qrUniqueConstraint = uq.recordset?.[0]?.ConstraintName;
    if (qrUniqueConstraint) {
        await pool.request().query(`ALTER TABLE [dbo].[Registrations] DROP CONSTRAINT [${qrUniqueConstraint}]`);
        console.log(`Dropped unique constraint on Registrations.QRCode: ${qrUniqueConstraint}`);
    } else {
        console.log('No unique constraint found on Registrations.QRCode.');
    }

    const rows = await pool.request().query(`
        SELECT RegistrationID, UserID, QRCode
        FROM [dbo].[Registrations]
        ORDER BY RegistrationID ASC
    `);

    let updatedRows = 0;
    for (const row of rows.recordset || []) {
        const userId = Number(row.UserID);
        if (!Number.isInteger(userId) || userId <= 0) continue;

        const expected = buildStudentQrToken(userId);
        if (String(row.QRCode || '').trim() === expected) continue;

        await pool.request()
            .input('RegistrationID', sql.Int, Number(row.RegistrationID))
            .input('QRCode', sql.NVarChar(255), expected)
            .query(`
                UPDATE [dbo].[Registrations]
                SET QRCode = @QRCode
                WHERE RegistrationID = @RegistrationID
            `);
        updatedRows += 1;
    }

    console.log(`Updated rows to EDUQR format: ${updatedRows}`);

    const sample = await pool.request().query(`
        SELECT TOP 10 RegistrationID, EventID, UserID, Status, QRCode
        FROM [dbo].[Registrations]
        ORDER BY RegistrationID ASC;
    `);

    console.log('Sample after migration:');
    console.log(JSON.stringify(sample.recordset || [], null, 2));

    process.exit(0);
})().catch((err) => {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
});
