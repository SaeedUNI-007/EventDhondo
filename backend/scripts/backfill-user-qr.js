const { poolPromise, sql } = require('../db');

async function main() {
  const rawUserId = process.argv[2];
  const userId = Number(rawUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Usage: node scripts/backfill-user-qr.js <userId>');
  }

  const pool = await poolPromise;

  const result = await pool.request()
    .input('UserID', sql.Int, userId)
    .query(`
      UPDATE [dbo].[Registrations]
      SET QRCode = CAST(NEWID() AS NVARCHAR(255))
      WHERE UserID = @UserID
        AND Status <> 'Cancelled'
        AND (QRCode IS NULL OR LTRIM(RTRIM(QRCode)) = '');

      SELECT COUNT(1) AS ActiveWithQR
      FROM [dbo].[Registrations]
      WHERE UserID = @UserID
        AND Status <> 'Cancelled'
        AND QRCode IS NOT NULL
        AND LTRIM(RTRIM(QRCode)) <> '';
    `);

  console.log(`User ${userId} active registrations with QR: ${result.recordset?.[0]?.ActiveWithQR ?? 0}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
