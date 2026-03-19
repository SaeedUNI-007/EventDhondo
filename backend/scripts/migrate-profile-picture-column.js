require('dotenv').config();
const sql = require('mssql');

async function run() {
  const cfg = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
    port: Number(process.env.DB_PORT) || 1433,
  };

  const pool = await sql.connect(cfg);

  await pool.request().query(
    "IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.StudentProfiles') AND c.name='ProfilePictureURL' AND t.name='nvarchar' AND c.max_length<>-1) BEGIN ALTER TABLE dbo.StudentProfiles ALTER COLUMN ProfilePictureURL NVARCHAR(MAX) NULL; END"
  );

  await pool.request().query(
    "IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.OrganizerProfiles') AND c.name='ProfilePictureURL' AND t.name='nvarchar' AND c.max_length<>-1) BEGIN ALTER TABLE dbo.OrganizerProfiles ALTER COLUMN ProfilePictureURL NVARCHAR(MAX) NULL; END"
  );

  const rs = await pool.request().query(
    "SELECT OBJECT_NAME(c.object_id) AS TableName, c.name AS ColumnName, c.max_length AS MaxLen FROM sys.columns c WHERE c.name='ProfilePictureURL' AND c.object_id IN (OBJECT_ID('dbo.StudentProfiles'), OBJECT_ID('dbo.OrganizerProfiles')) ORDER BY TableName"
  );

  console.log('Updated columns:', rs.recordset);
  await pool.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
