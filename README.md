# 🚀 EventDhondo - Project Setup & Weekend Sprint #1

**Goal:** Student Registration, Login, and Event Dashboard.

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
3.  Run `npm install` then `node server.js`. 
4.  If you see **"✅ Connected to SQL Server"**, your bridge is working!

---

## 📅 Weekend Sprint Tasks

### **Member 1: SQL Lead (Hamid)**
*   **Support:** Helping team debug the connection steps above.
*   **Data:** Provided `sp_RegisterStudent` and `vw_UpcomingEvents` for team use.

### **Member 2: Backend Dev**
*   **Task 1:** `POST /api/auth/register` -> Call `sp_RegisterStudent`.
*   **Task 2:** `GET /api/interests` -> `SELECT * FROM Interests`.
*   **Task 3:** `POST /api/auth/login` -> Verify credentials.
*   **Task 4:** `GET /api/events` -> `SELECT * FROM vw_UpcomingEvents`.

### **Member 3: Frontend Dev**
*   **Task 1:** `Register.js` -> Build form. Fetch interests from API for the dropdown.
*   **Task 2:** `Login.js` -> Email/PW. Save `UserID` to `localStorage` on success.
*   **Task 3:** `Dashboard.js` -> Call `/api/events` and display cards.

---

## 📜 Team Rules

1.  **Morning:** `git pull` before you code.
2.  **Evening:** `git push` before you sleep.
3.  **Schema Master:** Do **NOT** change SQL tables locally. Ask Hamid to update the master script so everyone stays in sync.
4.  **No CSS:** Focus on data flow first. Make it work, then make it pretty.

---

### **Success Check for Sunday Night:**
1.  Can I register a new student account in React?
2.  Can I log in with that account?
3.  Can I see the list of events on the dashboard?

**Let's get it done!**

**Post request Check Command on CMD**
`curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@fast.edu.pk\",\"password\":\"hashed_pw_1\"}"`