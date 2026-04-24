USE [EventDhondo];
GO

IF OBJECT_ID(N'dbo.sp_AddNotification', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE dbo.sp_AddNotification AS BEGIN SET NOCOUNT ON; RETURN; END');
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
GO


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

        -- Mass notify everyone registered for this event
        INSERT INTO [dbo].[Notifications] (UserID, Title, Message, RelatedEventID, Status)
        SELECT UserID, 'Event Cancelled', 'The event you registered for has been cancelled.', @EventID, 'Pending'
        FROM [dbo].[Registrations]
                WHERE EventID = @EventID
                    AND Status <> 'Cancelled';

        COMMIT TRANSACTION;
        SELECT 'Success' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error' + ERROR_MESSAGE() AS Message;
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


-- [OPERATIONS] Mark Attendance via QR Scan
CREATE PROCEDURE sp_MarkAttendance
    @QRCode NVARCHAR(255), @AdminID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RegID INT = (SELECT RegistrationID FROM Registrations WHERE QRCode = @QRCode);
    IF @RegID IS NULL THROW 50002, 'Invalid QR Code', 1;

    INSERT INTO Attendance (RegistrationID, CheckInMethod, VerifiedBy) VALUES (@RegID, 'QR_Scan', @AdminID);
    SELECT 'Attendance Marked' AS Message;
END;
GO

-- [FEEDBACK] Submit Review (Only if Attended)
CREATE PROCEDURE sp_AddReview
    @EventID INT, @UserID INT, @Rating INT, @ValueForTimeRating INT = NULL, @Text NVARCHAR(MAX)
AS
BEGIN
    DECLARE @AttID INT = (SELECT a.AttendanceID FROM Attendance a JOIN Registrations r ON a.RegistrationID = r.RegistrationID WHERE r.EventID = @EventID AND r.UserID = @UserID);
    IF @AttID IS NULL THROW 50003, 'Must attend event to review', 1;
    INSERT INTO EventReviews (EventID, UserID, AttendanceID, OverallRating, ValueForTimeRating, ReviewText) VALUES (@EventID, @UserID, @AttID, @Rating, @ValueForTimeRating, @Text);
END;
GO

-- [PORTFOLIO] Add Achievement (1st/2nd/3rd Place)
CREATE PROCEDURE sp_AddAchievement
    @UserID INT, @EventID INT, @Position NVARCHAR(50), @Desc NVARCHAR(MAX)
AS
BEGIN
    INSERT INTO StudentAchievements (UserID, EventID, Position, AchievementDate, [Description])
    VALUES (@UserID, @EventID, @Position, CAST(GETDATE() AS DATE), @Desc);
    
    EXEC sp_AddNotification @UserID, 'New Achievement!', 'You earned a position in an event!', @EventID;
END;
GO

-- [AUTH] Register Organizer (Societies/Clubs)
CREATE PROCEDURE sp_RegisterOrganizer
    @Email NVARCHAR(100), @PasswordHash NVARCHAR(255), @OrgName NVARCHAR(150), @Desc NVARCHAR(MAX), @ContactEmail NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO [Users] (Email, PasswordHash, [Role], VerificationStatus) 
        VALUES (@Email, @PasswordHash, 'Organizer', 'Pending'); -- Admin must verify
        
        DECLARE @NewUserID INT = SCOPE_IDENTITY();
        INSERT INTO [OrganizerProfiles] (UserID, OrganizationName, [Description], ContactEmail) 
        VALUES (@NewUserID, @OrgName, @Desc, @ContactEmail);
        
        COMMIT; SELECT @NewUserID AS NewUserID, 'Success' AS Message;
    END TRY
    BEGIN CATCH ROLLBACK; SELECT -1 AS NewUserID, ERROR_MESSAGE() AS Message; END CATCH
END;
GO

-- [ADMIN] Verify Organizer (Feature 1)
CREATE PROCEDURE sp_VerifyOrganizer
    @OrganizerID INT, @Status NVARCHAR(10) -- 'Verified' or 'Rejected'
AS
BEGIN
    UPDATE OrganizerProfiles SET VerificationStatus = @Status WHERE UserID = @OrganizerID;
    UPDATE Users SET VerificationStatus = @Status WHERE UserID = @OrganizerID;
END;
GO

-- [ADMIN] Reject Organizer Application with Optional Reason
CREATE PROCEDURE sp_RejectOrganizer
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

        -- Delete the organizer user row; OrganizerProfiles is removed by ON DELETE CASCADE.
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

-- [RECS] Get Recommended Events (weighted ranking, deterministic output)
IF OBJECT_ID(N'dbo.sp_GetRecommendedEvents', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetRecommendedEvents;
GO

CREATE PROCEDURE dbo.sp_GetRecommendedEvents
    @UserID INT,
    @TopN INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @Department NVARCHAR(100) = (
        SELECT TOP 1 Department
        FROM StudentProfiles
        WHERE UserID = @UserID
    );

    ;WITH CandidateEvents AS (
        SELECT
            e.EventID,
            e.OrganizerID,
            e.Title,
            e.Description,
            e.EventType,
            e.EventDate,
            e.EventTime,
            e.Venue,
            e.Capacity,
            e.RegistrationDeadline,
            e.Status,
            e.PosterURL,
            e.CreatedAt,
            e.UpdatedAt
        FROM Events e
        WHERE e.Status = 'Published'
          AND e.EventDate >= @Today
          AND NOT EXISTS (
              SELECT 1
              FROM Registrations r
              WHERE r.EventID = e.EventID
                AND r.UserID = @UserID
                AND r.Status <> 'Cancelled'
          )
    ),
    InterestTerms AS (
        SELECT DISTINCT
            ui.InterestID,
            i.InterestName
        FROM UserInterests ui
        JOIN Interests i ON i.InterestID = ui.InterestID
        WHERE ui.UserID = @UserID
    ),
    InterestMatch AS (
        SELECT
            ce.EventID,
            COUNT(DISTINCT it.InterestID) AS MatchedInterests
        FROM CandidateEvents ce
        JOIN InterestTerms it
          ON LOWER(ISNULL(ce.EventType, '')) LIKE '%' + LOWER(it.InterestName) + '%'
          OR LOWER(ISNULL(ce.Title, '')) LIKE '%' + LOWER(it.InterestName) + '%'
          OR LOWER(ISNULL(ce.Description, '')) LIKE '%' + LOWER(it.InterestName) + '%'
        GROUP BY ce.EventID
    ),
    PeerPopularity AS (
        SELECT
            ce.EventID,
            COUNT(*) AS SameDeptRegistrations
        FROM CandidateEvents ce
        JOIN Registrations r ON r.EventID = ce.EventID AND r.Status = 'Confirmed'
        JOIN StudentProfiles sp ON sp.UserID = r.UserID
        WHERE @Department IS NOT NULL
          AND sp.Department = @Department
        GROUP BY ce.EventID
    ),
    Trending AS (
        SELECT
            ce.EventID,
            COUNT(*) AS TotalRegistrations
        FROM CandidateEvents ce
        LEFT JOIN Registrations r ON r.EventID = ce.EventID AND r.Status = 'Confirmed'
        GROUP BY ce.EventID
    ),
    UserHistory AS (
        SELECT DISTINCT e.EventType
        FROM Registrations r
        JOIN Attendance a ON a.RegistrationID = r.RegistrationID
        JOIN Events e ON e.EventID = r.EventID
        WHERE r.UserID = @UserID
    )
    SELECT TOP (CASE WHEN @TopN IS NULL OR @TopN <= 0 THEN 10 ELSE @TopN END)
        ce.EventID,
        ce.OrganizerID,
        ce.Title,
        ce.Description,
        ce.EventType,
        ce.EventDate,
        ce.EventTime,
        ce.Venue,
        ce.Capacity,
        ce.RegistrationDeadline,
        ce.Status,
        ce.PosterURL,
        ce.CreatedAt,
        ce.UpdatedAt,
        CAST(
            (ISNULL(im.MatchedInterests, 0) * 40)
            + CASE WHEN uh.EventType IS NOT NULL THEN 20 ELSE 0 END
            + (ISNULL(pp.SameDeptRegistrations, 0) * 5)
            + (ISNULL(t.TotalRegistrations, 0) * 2)
            AS INT
        ) AS RecommendationScore,
        CASE
            WHEN ISNULL(im.MatchedInterests, 0) > 0 THEN 'Matches your interests'
            WHEN uh.EventType IS NOT NULL THEN 'Similar to events you attended'
            WHEN ISNULL(pp.SameDeptRegistrations, 0) > 0 THEN 'Popular in your department'
            ELSE 'Trending campus-wide'
        END AS RecommendationReason
    FROM CandidateEvents ce
    LEFT JOIN InterestMatch im ON im.EventID = ce.EventID
    LEFT JOIN PeerPopularity pp ON pp.EventID = ce.EventID
    LEFT JOIN Trending t ON t.EventID = ce.EventID
    LEFT JOIN UserHistory uh ON uh.EventType = ce.EventType
    ORDER BY RecommendationScore DESC, ce.EventDate ASC, ce.EventID DESC;
END;
GO

IF OBJECT_ID(N'dbo.sp_GetOrganizerReputation', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetOrganizerReputation;
GO

CREATE PROCEDURE dbo.sp_GetOrganizerReputation
    @OrganizerID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        v.OrganizerID,
        v.OrganizationName,
        v.TotalReviewsReceived,
        v.TotalEventsHosted,
        v.AvgOverallRating,
        v.AvgOrganizationRating,
        v.AvgContentRating,
        v.AvgVenueRating,
        v.AvgValueForTimeRating,
        v.ReputationScore,
        CASE
            WHEN v.ReputationScore >= 4.5 THEN 'Platinum'
            WHEN v.ReputationScore >= 4.0 THEN 'Gold'
            WHEN v.ReputationScore >= 3.5 THEN 'Silver'
            ELSE 'Standard'
        END AS ReputationTier
    FROM vw_OrganizerReputationScore v
    WHERE @OrganizerID IS NULL OR v.OrganizerID = @OrganizerID
    ORDER BY v.ReputationScore DESC, v.TotalReviewsReceived DESC, v.OrganizerID ASC;
END;
GO

-- [UTIL] Mark Notification as Read
CREATE PROCEDURE sp_ReadNotification
    @NotificationID BIGINT
AS
BEGIN
    UPDATE Notifications SET Status = 'Read', ReadAt = SYSDATETIMEOFFSET() WHERE NotificationID = @NotificationID;
END;
GO

/* Notifications: get paged notifications for a user */
IF OBJECT_ID(N'dbo.sp_GetNotificationsForUser', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetNotificationsForUser;
GO
CREATE PROCEDURE dbo.sp_GetNotificationsForUser
    @UserID INT,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT
        NotificationID AS notificationId,
        UserID    AS userId,
        Title     AS title,
        Message   AS message,
        RelatedEventID AS relatedEventId,
        Status    AS status,
        CreatedAt AS createdAt,
        ReadAt    AS readAt
    FROM Notifications
    WHERE UserID = @UserID
    ORDER BY CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

/* Notifications: get single notification by id */
IF OBJECT_ID(N'dbo.sp_GetNotificationById', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetNotificationById;
GO
CREATE PROCEDURE dbo.sp_GetNotificationById
    @NotificationID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        NotificationID AS notificationId,
        UserID         AS userId,
        Title          AS title,
        Message        AS message,
        RelatedEventID AS relatedEventId,
        Status         AS status,
        CreatedAt      AS createdAt,
        ReadAt         AS readAt
    FROM Notifications
    WHERE NotificationID = @NotificationID;
END;
GO

/* Notifications: mark notifications read (CSV input) */
IF OBJECT_ID(N'dbo.sp_MarkNotificationsRead', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_MarkNotificationsRead;
GO
CREATE PROCEDURE dbo.sp_MarkNotificationsRead
    @UserID INT,
    @NotificationIDs NVARCHAR(MAX) -- CSV: '101,102'
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH ids AS (
        SELECT TRY_CAST(value AS BIGINT) AS id
        FROM STRING_SPLIT(@NotificationIDs, ',')
        WHERE TRY_CAST(value AS BIGINT) IS NOT NULL
    )
    UPDATE n
    SET Status = 'Read', ReadAt = SYSDATETIMEOFFSET()
    FROM Notifications n
    JOIN ids i ON n.NotificationID = i.id
    WHERE n.UserID = @UserID;
END;
GO
