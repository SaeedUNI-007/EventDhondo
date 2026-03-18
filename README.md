# EventDhondo

## Description
EventDhondo is a campus event discovery and management platform. It helps students find relevant events, register quickly, build teams, and receive in-app updates, while organizers can manage event operations and participant workflows.

## Team Members
- Muhammad Hamid Abad (24L-2534)
- Abdullah Zia Chaudhry (24L-2507)
- Abdullah Saeed (24L-2529)

## Tech Stack
- Backend: Node.js, Express, mssql, bcrypt
- Frontend: Next.js (React)
- Database: Microsoft SQL Server

## Project Structure
```text
EventDhondo/
|- backend/        # Express API
|- frontend/       # Next.js app
|- database/       # SQL schema, data, views, procedures
|- README.md
```

## Prerequisites
- Node.js 18+
- npm 9+
- SQL Server (SQLEXPRESS or equivalent)
- SQL Server Management Studio (recommended)

## Environment Variables
Create a `.env` file inside `backend/`:

```env
DB_USER=sa
DB_PASSWORD=your_sa_password_here
DB_SERVER=localhost
DB_DATABASE=EventDhondo
DB_PORT=1433
PORT=5000
```

## Database Setup
Run the SQL files in this order:

1. `database/SQLschema.sql`
2. `database/procedures.sql`
3. `database/views.sql`
4. `database/SQLdata.sql`

If needed, enable SQL Server authentication (Mixed Mode), enable TCP/IP, and make sure port `1433` is available.

## How to Run
### Backend
```bash
cd backend
npm install
node server.js
```

Expected log messages:
- `Connected to SQL Server Successfully!`
- `Server running on http://localhost:5000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.


## Contributing
1. Create a feature branch.
2. Commit with clear messages.
3. Open a pull request with test steps and screenshots (if UI changes).
