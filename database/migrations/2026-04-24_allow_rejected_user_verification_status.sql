USE [EventDhondo];
GO

DECLARE @ConstraintName SYSNAME;

SELECT TOP 1 @ConstraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c
  ON c.object_id = cc.parent_object_id
 AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.Users')
  AND c.name = N'VerificationStatus';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE dbo.Users DROP CONSTRAINT [' + @ConstraintName + N']');
END
GO

ALTER TABLE dbo.Users
ADD CONSTRAINT CK_Users_VerificationStatus
CHECK (VerificationStatus IN ('Pending', 'Verified', 'Rejected'));
GO
