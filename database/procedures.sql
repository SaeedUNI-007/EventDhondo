USE [EventDhondo];
GO

CREATE OR ALTER PROCEDURE sp_RegisterStudent
    @Email NVARCHAR(100),
    @PasswordHash NVARCHAR(255),
    @FirstName NVARCHAR(50),
    @LastName NVARCHAR(50),
    @Department NVARCHAR(100),
    @YearOfStudy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Insert into the central Users table
        INSERT INTO [Users] (Email, PasswordHash, [Role], VerificationStatus)
        VALUES (@Email, @PasswordHash, 'Student', 'Verified');

        -- 2. Get the newly created UserID
        DECLARE @NewUserID INT = SCOPE_IDENTITY();

        -- 3. Insert into the StudentProfiles table using that ID
        INSERT INTO [StudentProfiles] (UserID, FirstName, LastName, Department, YearOfStudy)
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
CREATE OR ALTER PROCEDURE sp_UpdateStudentProfile
    @UserID INT,
    @FirstName NVARCHAR(50),
    @LastName NVARCHAR(50),
    @Department NVARCHAR(100),
    @YearOfStudy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Update the specific profile table
        UPDATE StudentProfiles
        SET FirstName = @FirstName,
            LastName = @LastName,
            Department = @Department,
            YearOfStudy = @YearOfStudy
        WHERE UserID = @UserID;

        COMMIT TRANSACTION;
        SELECT 'Success' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'Error: ' + ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO