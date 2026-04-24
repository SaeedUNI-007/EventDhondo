USE [EventDhondo];
GO

CREATE OR ALTER PROCEDURE dbo.sp_CancelEvent
    @EventID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM [dbo].[Events] WHERE EventID = @EventID)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Event not found.' AS Message;
            RETURN;
        END

        UPDATE [dbo].[Events]
        SET Status = 'Cancelled'
        WHERE EventID = @EventID
          AND Status <> 'Cancelled';

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Event is already cancelled.' AS Message;
            RETURN;
        END

        INSERT INTO [dbo].[Notifications] (UserID, Title, Message, RelatedEventID, Status)
        SELECT UserID, 'Event Cancelled', 'The event you registered for has been cancelled.', @EventID, 'Pending'
        FROM [dbo].[Registrations]
        WHERE EventID = @EventID
          AND Status <> 'Cancelled';

        COMMIT TRANSACTION;
        SELECT 'Success' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        SELECT 'Error' + ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO
