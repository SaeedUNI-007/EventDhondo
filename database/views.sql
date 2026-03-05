CREATE OR ALTER VIEW vw_UpcomingEvents AS
SELECT 
    e.EventID,
    e.Title,
    e.Description,
    e.EventType,
    e.EventDate,
    e.EventTime,
    e.Venue,
    e.Capacity,
    e.Status,
    o.OrganizationName AS Organizer,
    o.ContactEmail AS OrganizerEmail,
    -- This gets the first category name assigned to the event
    (SELECT TOP 1 CategoryName FROM EventCategories ec 
     JOIN EventCategoryMapping ecm ON ec.CategoryID = ecm.CategoryID 
     WHERE ecm.EventID = e.EventID) AS Category
FROM [Events] e
JOIN [OrganizerProfiles] o ON e.OrganizerID = o.UserID
WHERE e.Status = 'Published' AND e.EventDate >= CAST(GETDATE() AS DATE);