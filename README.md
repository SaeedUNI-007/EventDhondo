# 🚀 EventDhondo - Sprint #2

# 🚀 Sprint 2: Event Operations & In-App Alerts

This sprint focuses on the "Action" phase: Registering for events, forming teams, and managing real-time in-app notifications.

---

## 🛠 1. Immediate Setup (Do this FIRST)
Each member runs their own **local** SQL Server and **local** Backend.

1.  **Clone the Repo:** `git pull origin main`.
2.  **Database Creation:**
    *   Open SSMS. Run everything in `/database/schema.sql`.
    *   Run `/database/procedures.sql` and `/database/views.sql`.
    *   Run `/database/data.sql` to get the starter data.

---

## 🔌 2. SQL Server Connection Guide (Don't skip this!)
To allow the Node.js backend to talk to your local SQL Server, you **must** perform these 3 steps on your machine:

### A. Enable SQL Server Authentication (Mixed Mode)
1.  Open **SSMS** -> Right-click **Server Name** -> **Properties**.
2.  Go to **Security** -> Select **"SQL Server and Windows Authentication mode"**.
3.  Go to **Security folder** (in the sidebar) -> **Logins** -> Right-click **`sa`** -> **Properties**.
4.  Set a password (e.g., `MyPassword123`) and **Enable** the login under the **Status** page.
5.  **Restart SQL Server** (Right-click Server Name -> Restart).

### B. Enable TCP/IP & Port 1433
1.  Open **SQL Server Configuration Manager**.
2.  **Protocols for SQLEXPRESS** -> Right-click **TCP/IP** -> **Enable**.
3.  Double-click **TCP/IP** -> **IP Addresses** tab -> Scroll to **IPAll**.
4.  Set **TCP Port** to `1433` and clear "TCP Dynamic Ports".
5.  **SQL Server Services** (sidebar) -> Right-click **SQL Server Browser** -> **Start** it.

### C. Backend Configuration
1.  Go to `/backend`. Create a file named **`.env`**.
2.  Paste and fill this in:
    ```text
    DB_USER=sa
    DB_PASSWORD=your_sa_password_here
    DB_SERVER=localhost
    DB_DATABASE=EventDhondo
    PORT=5000
    ```
3.  Run `npm install` then `node server.js` in the `/backend` directory. 
4.  If you see **"✅ Connected to SQL Server"**, your bridge is working!
5.  Run `npm install` then `npm run dev` in the `/frontend` directory. 


---

## 🎯 User Stories to Complete

### 1. The "One-Click" Story
> *As a student, I can register/unregister for events. The system enforces capacity limits and sends an in-app alert.*
*   **SQL (Hamid):** Provide `sp_RegisterForEvent` and `sp_UnregisterFromEvent`.
*   **Backend:** Implement `POST /api/events/register` and `DELETE /api/events/unregister`.

### 2. The "Competitive Team" Story
> *As a student, I can create a team and invite members. Invited members get a notification to Accept/Decline.*
*   **SQL (Hamid):** Provide `sp_CreateTeam` and `sp_InviteTeamMember`.
*   **Backend:** Implement Team CRUD and invitation logic.

### 3. The "In-App Ticket" Story
> *As a student, my unique QR code is displayed in my "My Tickets" section. As an organizer, I can scan this code (enter the string) to mark attendance.*
*   **Backend:** API to fetch the `QRCode` string. API `POST /api/events/check-in` to update attendance.
*   **Frontend:** Create a scannable view for students and a "Scanner" interface for organizers.

### 4. The "Notification Center" Story
> *As a student, I receive reminders and cancellation alerts via a "Bell" icon on my dashboard. If I am online, a pop-up (Toast) appears.*
*   **SQL (Hamid):** Stored procedure `sp_AddNotification` and a view for unread alerts.
*   **Frontend:** Add a **Notification Bell** to the Navbar and use a library like `react-hot-toast` for pop-ups.

---

## 🛠 Action Items by Member

### **Member 1: SQL Lead (Hamid)**
*   **Registration Logic:** Ensure the `sp_RegisterForEvent` generates a record in the `Notifications` table immediately upon success.
*   **Team Procedures:**
    *   `sp_CreateTeam`: Creates the team and makes the creator the leader.
    *   `sp_InviteMember`: Adds to `TeamMembers` with status 'Pending' and alerts the invited user.
*   **Event Cancellation:** Create a procedure `sp_CancelEvent` that sets event status to 'Cancelled' and inserts notification records for **all** registrants.

### **Member 2: Backend Dev (Express)**
*   **Notification API:** `GET /api/notifications/:userId` (fetches unread alerts). `PUT /api/notifications/read/:id` (marks alert as read).
*   **Check-in API:** `POST /api/events/check-in`. It validates the QR string against the `Registrations` table and creates an `Attendance` record.
*   **The "Polling" Logic:** Create an endpoint the frontend can call every 60 seconds to check for new alerts in the `Notifications` table.

### **Member 3: Frontend Dev (Next.js)**
*   **The Navbar Bell:** Add a bell icon that shows a red dot if there are unread notifications.
*   **The "My Tickets" Page:** A page showing all confirmed events with their QR codes generated from the DB string.
*   **Toast Notifications:** Integrate a library like `sonner` or `react-hot-toast` so when a user is online and a new event is published, a pop-up appears Or just simply a pop-up to give a reminder to the user when the time comes.

---

## 🚀 Sprint 2 Definition of Done:
1.  **Atomic Registration:** I cannot register for an event that is full.
2.  **Notification Bell:** When I register, a red dot appears on the bell icon.
3.  **Team Modal:** I can invite a friend, and they see a "Team Invitation" in their notifications.
4.  **Attendance:** Entering a student's QR string on the Organizer dashboard marks them as `Attended`.

**Let's get it done!**

**Post request Check Command on CMD**
`curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@fast.edu.pk\",\"password\":\"hashed_pw_1\"}"`