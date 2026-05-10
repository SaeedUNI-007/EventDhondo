-- EventDhondo Database Triggers

USE [EventDhondo];
GO

-- ============================================================================
-- TRIGGER 1: Auto-Mark Event as Completed When Date/Time Passes
-- ============================================================================
-- Purpose: Automatically update event status from 'Published' to 'Completed' 
--          when the event date/time has passed
-- Table: Events

DROP TRIGGER IF EXISTS tr_AutoCompleteExpiredEvents;
GO

CREATE TRIGGER tr_AutoCompleteExpiredEvents
ON [Events]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Update events where date has passed and status is still 'Published'
    UPDATE [Events]
    SET [Status] = 'Completed',
        [UpdatedAt] = SYSDATETIMEOFFSET()
    WHERE [Status] = 'Published'
      AND CAST([EventDate] AS DATETIME2) < SYSDATETIME()
      AND [EventID] IN (SELECT [EventID] FROM inserted);
END;
GO

-- ============================================================================
-- TRIGGER 2: Track User Login and Create Welcome Notification
-- ============================================================================
-- Purpose: Update LastLogin timestamp and create a welcome-back notification 
--          when a user successfully logs in (when LastLogin is NULL or outdated)
-- Table: Users
-- Type: AFTER UPDATE
-- Note: Backend should update LastLogin on successful login

DROP TRIGGER IF EXISTS tr_TrackUserLogin;
GO

CREATE TRIGGER tr_TrackUserLogin
ON [Users]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Only process if LastLogin was updated (successful login detected)
    IF UPDATE([LastLogin])
    BEGIN
        -- Create welcome-back notification for users with Student role
        INSERT INTO [Notifications]
            ([UserID], [Title], [Message], [Status], [CreatedAt])
        SELECT 
            i.[UserID],
            'Welcome Back!',
            'Welcome back to EventDhondo! Check out new events and stay updated with your upcoming registrations.',
            'Sent',
            SYSDATETIMEOFFSET()
        FROM inserted i
        WHERE i.[Role] = 'Student'
          AND i.[LastLogin] IS NOT NULL
          -- Only notify if they haven't been notified in the last 12 hours
          AND NOT EXISTS (
              SELECT 1 FROM [Notifications] n
              WHERE n.[UserID] = i.[UserID]
                AND n.[Title] = 'Welcome Back!'
                AND DATEDIFF(HOUR, n.[CreatedAt], SYSDATETIMEOFFSET()) < 12
          );
    END;
END;
GO

-- ============================================================================
-- TRIGGER 3: Mark Event Notifications as Unread When Event Details Change
-- ============================================================================
-- Purpose: Reset notification status to 'Pending' for all students registered
--          when event details (date, venue, description) are modified
-- Table: Events
-- Type: AFTER UPDATE

DROP TRIGGER IF EXISTS tr_UnreadNotificationsOnEventUpdate;
GO

CREATE TRIGGER tr_UnreadNotificationsOnEventUpdate
ON [Events]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Only trigger if critical event details changed
    IF UPDATE([EventDate]) OR UPDATE([EventTime]) OR UPDATE([Venue]) OR UPDATE([Description])
    BEGIN
        -- Find all registrations for updated events and create new notifications
        INSERT INTO [Notifications]
            ([UserID], [Title], [Message], [RelatedEventID], [Status], [CreatedAt])
        SELECT DISTINCT
            r.[UserID],
            'Event Details Updated',
            'The event "' + e.[Title] + '" has been updated. Please review the changes.',
            e.[EventID],
            'Pending',
            SYSDATETIMEOFFSET()
        FROM inserted e
        INNER JOIN [Registrations] r ON e.[EventID] = r.[EventID]
        WHERE r.[Status] IN ('Confirmed', 'Attended')
          AND NOT EXISTS (
              SELECT 1 FROM [Notifications] n
              WHERE n.[UserID] = r.[UserID]
                AND n.[RelatedEventID] = e.[EventID]
                AND n.[Title] = 'Event Details Updated'
                AND DATEDIFF(HOUR, n.[CreatedAt], SYSDATETIMEOFFSET()) < 1
          );
    END;
END;
GO


-- ============================================================================
-- Verification Queries (run these to verify triggers are working)
-- ============================================================================
/*
-- Check all triggers are created:
SELECT name, create_date FROM sys.triggers ORDER BY name;

-- Test Trigger 1 - Auto-Complete: Insert a past event
INSERT INTO [Events] ([OrganizerID], [Title], [EventDate], [EventTime], [Venue], [City], [Capacity], [RegistrationDeadline], [Status])
VALUES (1, 'Test Past Event', CAST(GETDATE() - 1 AS DATE), '10:00:00', 'Hall A', 'Lahore', 50, GETDATE(), 'Published');
-- Then query: SELECT EventID, Status FROM [Events] WHERE Title = 'Test Past Event';

-- Test Trigger 2 - Login Notification:
-- Update a user's LastLogin: UPDATE [Users] SET [LastLogin] = SYSDATETIMEOFFSET() WHERE [UserID] = 1;
-- Then check: SELECT * FROM [Notifications] WHERE [Title] = 'Welcome Back!' ORDER BY CreatedAt DESC;

-- Test Trigger 3 - Event Update Notification:
-- Update an existing event details and check notifications table for "Event Details Updated" entries
*/
GO
