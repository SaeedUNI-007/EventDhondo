USE [EventDhondo];
GO

IF OBJECT_ID(N'dbo.sp_RegisterStudent', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_RegisterStudent;
GO

CREATE PROCEDURE dbo.sp_RegisterStudent
    @Email NVARCHAR(100),
    @PasswordHash NVARCHAR(255),
    @FirstName NVARCHAR(50),
    @LastName NVARCHAR(50),
    @Department NVARCHAR(100),
    @YearOfStudy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Insert into the central Users table
        INSERT INTO [dbo].[Users] (Email, PasswordHash, [Role], VerificationStatus)
        VALUES (@Email, @PasswordHash, 'Student', 'Verified');

        -- 2. Get the newly created UserID
        DECLARE @NewUserID INT = SCOPE_IDENTITY();

        -- 3. Insert into the StudentProfiles table using that ID
        INSERT INTO [dbo].[StudentProfiles] (UserID, FirstName, LastName, Department, YearOfStudy)
        VALUES (@NewUserID, @FirstName, @LastName, @Department, @YearOfStudy);

        COMMIT TRANSACTION;
        SELECT @NewUserID AS NewUserID, 'Success' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT -1 AS NewUserID, ERROR_MESSAGE() AS Message;
    END CATCH
END;


-- Procedure to update student profile details
IF OBJECT_ID(N'dbo.sp_UpdateStudentProfile', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_UpdateStudentProfile;
GO

CREATE PROCEDURE dbo.sp_UpdateStudentProfile
    @UserID INT,
    @FirstName NVARCHAR(50),
    @LastName NVARCHAR(50),
    @Department NVARCHAR(100),
    @YearOfStudy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Update the specific profile table
        UPDATE [dbo].[StudentProfiles]
        SET FirstName = @FirstName,
            LastName = @LastName,
            Department = @Department,
            YearOfStudy = @YearOfStudy
        WHERE UserID = @UserID;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Student profile not found.' AS Message;
            RETURN;
        END

        COMMIT TRANSACTION;
        SELECT 'Success' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'Error: ' + ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO


-- =========================================================================
-- SPRINT #2: CORE OPERATIONS STORED PROCEDURES
-- =========================================================================

-- 1. Register for an Event (with Capacity Check)
-- 1. Register for an Event (with Capacity Check & Concurrency Control)
IF OBJECT_ID(N'dbo.sp_RegisterForEvent', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_RegisterForEvent;
GO

CREATE PROCEDURE dbo.sp_RegisterForEvent
    @EventID INT,
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @EventStatus NVARCHAR(20);
        DECLARE @MaxCap INT; -- <--- ADDED THIS MISSING LINE

        -- Use UPDLOCK and HOLDLOCK to prevent race conditions for the last seat
        SELECT @MaxCap = e.Capacity,
               @EventStatus = e.Status
        FROM [dbo].[Events] e WITH (UPDLOCK, HOLDLOCK)
        WHERE e.EventID = @EventID;

        IF @MaxCap IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Event not found.' AS Message;
            RETURN;
        END

        IF @EventStatus <> 'Published'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Event is not open for registration.' AS Message;
            RETURN;
        END

        -- Check if already registered and active
        IF EXISTS (SELECT 1 FROM [dbo].[Registrations] WHERE EventID = @EventID AND UserID = @UserID AND Status != 'Cancelled')
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Already registered for this event.' AS Message;
            RETURN;
        END

        -- Check capacity
        DECLARE @CurrentCount INT = (SELECT COUNT(*) FROM [dbo].[Registrations] WHERE EventID = @EventID AND Status = 'Confirmed');

        IF @CurrentCount < @MaxCap
        BEGIN
            IF EXISTS (SELECT 1 FROM [dbo].[Registrations] WHERE EventID = @EventID AND UserID = @UserID AND Status = 'Cancelled')
            BEGIN
                UPDATE [dbo].[Registrations]
                SET Status = 'Confirmed',
                    CancelledAt = NULL,
                    RegistrationDate = SYSDATETIMEOFFSET(),
                    QRCode = CAST(NEWID() AS NVARCHAR(100))
                WHERE EventID = @EventID
                  AND UserID = @UserID
                  AND Status = 'Cancelled';
            END
            ELSE
            BEGIN
                INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
                VALUES (@EventID, @UserID, 'Confirmed', CAST(NEWID() AS NVARCHAR(100)));
            END

            -- Safety cleanup if user had an old waitlist entry.
            DELETE FROM [dbo].[RegistrationWaitlist]
            WHERE EventID = @EventID AND UserID = @UserID;
            
            -- Trigger a success notification
            EXEC [dbo].[sp_AddNotification] @UserID, 'Registration Success', 'You are confirmed for the event!', @EventID;
            
            COMMIT TRANSACTION;
            SELECT 'Success' AS Message;
        END
        ELSE
        BEGIN
            -- If full, check if already on waitlist
            IF EXISTS (SELECT 1 FROM [dbo].[RegistrationWaitlist] WHERE EventID = @EventID AND UserID = @UserID)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 'Error: Event is full and you are already waitlisted.' AS Message;
                RETURN;
            END

            -- Add to waitlist instead of registration
            INSERT INTO [dbo].[RegistrationWaitlist] (EventID, UserID)
            VALUES (@EventID, @UserID);

            EXEC [dbo].[sp_AddNotification] @UserID, 'Waitlist Update', 'Event is full. You have been added to the waitlist.', @EventID;

            COMMIT TRANSACTION;
            SELECT 'Waitlisted' AS Message;
        END
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error: ' + ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO

-- 2. Unregister from an Event
IF OBJECT_ID(N'dbo.sp_UnregisterFromEvent', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_UnregisterFromEvent;
GO

CREATE PROCEDURE dbo.sp_UnregisterFromEvent
    @EventID INT,
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [dbo].[Registrations]
    SET Status = 'Cancelled', CancelledAt = SYSDATETIMEOFFSET()
    WHERE EventID = @EventID
      AND UserID = @UserID
      AND Status <> 'Cancelled';

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT 'Error: Active registration not found.' AS Message;
        RETURN;
    END

    EXEC [dbo].[sp_AddNotification] @UserID, 'Registration Cancelled', 'Your registration has been cancelled.', @EventID;
    
    SELECT 'Success' AS Message;
END;
GO

-- 3. Create a Team for a Competition
IF OBJECT_ID(N'dbo.sp_CreateTeam', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CreateTeam;
GO

CREATE PROCEDURE dbo.sp_CreateTeam
    @EventID INT,
    @TeamName NVARCHAR(100),
    @LeaderID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Events] WHERE EventID = @EventID)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT -1 AS TeamID, 'Event not found.' AS Message;
            RETURN;
        END

        INSERT INTO [dbo].[Teams] (EventID, TeamName, TeamLeaderID)
        VALUES (@EventID, @TeamName, @LeaderID);

        DECLARE @NewTeamID INT = SCOPE_IDENTITY();

        -- Automatically add leader as an 'Accepted' member
        INSERT INTO [dbo].[TeamMembers] (TeamID, UserID, InvitationStatus, JoinedAt)
        VALUES (@NewTeamID, @LeaderID, 'Accepted', SYSDATETIMEOFFSET());

        COMMIT TRANSACTION;
        SELECT @NewTeamID AS TeamID, 'Success' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT -1 AS TeamID, ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO

-- 4. Invite a Member to a Team
IF OBJECT_ID(N'dbo.sp_InviteTeamMember', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_InviteTeamMember;
GO

CREATE PROCEDURE dbo.sp_InviteTeamMember
    @TeamID INT,
    @InvitedUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Teams] WHERE TeamID = @TeamID)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: Team not found.' AS Message;
            RETURN;
        END

        IF EXISTS (SELECT 1 FROM [dbo].[TeamMembers] WHERE TeamID = @TeamID AND UserID = @InvitedUserID)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 'Error: User is already in this team.' AS Message;
            RETURN;
        END

        INSERT INTO [dbo].[TeamMembers] (TeamID, UserID, InvitationStatus)
        VALUES (@TeamID, @InvitedUserID, 'Pending');

        -- Send notification to the invited user
        DECLARE @TeamName NVARCHAR(100) = (SELECT TeamName FROM [dbo].[Teams] WHERE TeamID = @TeamID);
        DECLARE @InviteMessage NVARCHAR(MAX);
        SET @InviteMessage = N'You have been invited to join team: ' + ISNULL(@TeamName, N'Unknown Team');

        EXEC [dbo].[sp_AddNotification]
            @UserID = @InvitedUserID,
            @Title = N'Team Invitation',
            @Message = @InviteMessage,
            @EventID = NULL;

        COMMIT TRANSACTION;
        SELECT 'Success' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error: ' + ERROR_MESSAGE() AS Message;
    END CATCH

END;
GO

-- 5. Cancel an Event (and notify all registrants)
IF OBJECT_ID(N'dbo.sp_CancelEvent', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CancelEvent;
GO

CREATE PROCEDURE dbo.sp_CancelEvent
    @EventID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
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

        -- Mass notify everyone registered for this event
        INSERT INTO [dbo].[Notifications] (UserID, Title, Message, RelatedEventID, Status)
        SELECT UserID, 'Event Cancelled', 'The event you registered for has been cancelled.', @EventID, 'Pending'
        FROM [dbo].[Registrations]
        WHERE EventID = @EventID AND Status = 'Confirmed';

        COMMIT TRANSACTION;
        SELECT 'Success' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error: ' + ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO

-- 6. Add a Single Notification
IF OBJECT_ID(N'dbo.sp_AddNotification', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_AddNotification;
GO

CREATE PROCEDURE dbo.sp_AddNotification
    @UserID INT,
    @Title NVARCHAR(255),
    @Message NVARCHAR(MAX),
    @EventID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[Notifications] (UserID, Title, Message, RelatedEventID, Status)
    VALUES (@UserID, @Title, @Message, @EventID, 'Pending');
END;
GO