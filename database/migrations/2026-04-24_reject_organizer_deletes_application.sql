USE [EventDhondo];
GO

CREATE OR ALTER PROCEDURE dbo.sp_RejectOrganizer
    @OrganizerID INT,
    @RejectionReason NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (
            SELECT 1
            FROM OrganizerProfiles op
            JOIN Users u ON u.UserID = op.UserID
            WHERE op.UserID = @OrganizerID
              AND u.[Role] = 'Organizer'
              AND op.VerificationStatus = 'Pending'
        )
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Organizer request not found or already processed.' AS Message;
            RETURN;
        END

        DELETE FROM Users
        WHERE UserID = @OrganizerID
          AND [Role] = 'Organizer';

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Failed to delete organizer application.' AS Message;
            RETURN;
        END

        COMMIT TRANSACTION;

        SELECT 'Success' AS Message, @OrganizerID AS OrganizerID, 'Removed' AS NewStatus;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT 'Error: ' + ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO
