USE [EventDhondo];
GO

/*
  Removes organizer applications previously rejected by admin so users can re-apply.
  This migration targets organizer accounts where either Users or OrganizerProfiles
  has VerificationStatus = 'Rejected'.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    ;WITH RejectedOrganizerUsers AS (
        SELECT DISTINCT u.UserID
        FROM dbo.Users u
        JOIN dbo.OrganizerProfiles op ON op.UserID = u.UserID
        WHERE u.[Role] = 'Organizer'
          AND (
                u.VerificationStatus = 'Rejected'
             OR op.VerificationStatus = 'Rejected'
          )
    )
    DELETE u
    FROM dbo.Users u
    JOIN RejectedOrganizerUsers r ON r.UserID = u.UserID;

    COMMIT TRANSACTION;

    PRINT 'Migration 2026-04-24_cleanup_rejected_organizer_applications.sql completed.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO
