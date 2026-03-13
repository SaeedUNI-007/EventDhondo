require('dotenv').config();
const bcrypt = require('bcrypt');
const { sql, poolPromise } = require('../db');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const SALT_ROUNDS = 10;

function isBcryptHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_REGEX.test(value);
}

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const pool = await poolPromise;

  const usersResult = await pool
    .request()
    .query('SELECT UserID, Email, PasswordHash FROM Users');

  const users = usersResult.recordset || [];
  const candidates = users.filter((user) => !isBcryptHash(user.PasswordHash));

  console.log(`Scanned users: ${users.length}`);
  console.log(`Needs migration: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No plaintext passwords found. Nothing to migrate.');
    await sql.close();
    return;
  }

  if (!shouldApply) {
    console.log('Dry-run only. No changes made.');
    console.log('Run with --apply to perform the migration.');
    console.log('Users to migrate:');
    for (const user of candidates) {
      console.log(`- UserID=${user.UserID}, Email=${user.Email}`);
    }
    await sql.close();
    return;
  }

  let updatedCount = 0;

  for (const user of candidates) {
    const currentPassword = user.PasswordHash;

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      console.log(`Skipping UserID=${user.UserID} (empty or invalid password value).`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(currentPassword, SALT_ROUNDS);

    const updateResult = await pool
      .request()
      .input('UserID', sql.Int, user.UserID)
      .input('OldPassword', sql.NVarChar(255), currentPassword)
      .input('NewPassword', sql.NVarChar(255), hashedPassword)
      .query(`
        UPDATE Users
        SET PasswordHash = @NewPassword
        WHERE UserID = @UserID AND PasswordHash = @OldPassword
      `);

    if (updateResult.rowsAffected[0] === 1) {
      updatedCount += 1;
      console.log(`Migrated UserID=${user.UserID}, Email=${user.Email}`);
    } else {
      console.log(`Skipped UserID=${user.UserID} because password changed during migration.`);
    }
  }

  console.log(`Migration complete. Updated users: ${updatedCount}`);
  await sql.close();
}

main().catch(async (error) => {
  console.error('Password migration failed:', error);
  try {
    await sql.close();
  } catch (_) {
    // Ignore close errors during failure cleanup.
  }
  process.exit(1);
});
