# EventDhondo Project Progress Report

Last verified: 2026-03-21

## 1. Executive Summary
EventDhondo is a campus event discovery and management platform with a monorepo structure:
- backend: Express API + SQL Server access
- frontend: Next.js app (App Router)
- database: SQL schema, procedures, views, seed data

Current maturity (estimated from codebase state):
- Core platform foundation: complete
- Student/organizer authentication and role routing: complete
- Event discovery dashboards: mostly complete
- Profile management: partially complete (works for student path, organizer update path has backend mismatch)
- Team and registration backend logic: implemented, but limited/no UI coverage
- Production hardening (security, tests, CI/CD): not complete

Overall: project appears around 65-75% feature-complete for an academic milestone/demo and not yet production-ready.

## 2. Architecture Snapshot

### Backend
- Runtime: Node.js (CommonJS)
- Framework: Express
- DB driver: mssql
- Security libs: bcrypt
- Middleware: CORS, JSON/body size limits, dotenv

Main route mounting:
- /api/auth -> auth.js
- /api -> data.js
- /api/teams -> team.js

### Frontend
- Framework: Next.js 16 + React 19
- Routing: App Router (frontend/app/*)
- Styling: Tailwind CSS v4 + custom CSS variables/theme classes
- State/data: localStorage + fetch calls to backend API

### Database
- Engine: Microsoft SQL Server
- Setup model: SQL-first scripts (schema/procedures/views/data)
- Domain model: users, roles, events, registrations, waitlists, attendance, teams, portfolio, notifications, reviews

## 3. What Has Been Implemented

### 3.1 Authentication and Role Handling
Implemented:
- Registration endpoint for student and organizer payloads
- Login endpoint with role return and userId
- Bcrypt password hashing for new registrations
- Legacy plaintext compatibility fallback during login for older records
- University email restriction to @fast.edu.pk

Frontend behavior implemented:
- Login persists userID/userId/userRole/userEmail/displayName in localStorage
- Role-based redirect:
  - student -> /dashboard
  - organizer -> /dashboardO
- Registration supports both student and organizer forms

### 3.2 Event Discovery and Event Operations
Implemented backend event functionality:
- GET /api/events with filtering behavior:
  - student mode: reads from vw_UpcomingEvents (published, future events)
  - organizer mode: raw events by organizerId including non-cancelled records
- GET /api/interests
- POST /api/events/register (stored procedure based)
- POST /api/events/check-in (QR code attendance marking)
- DELETE /api/events/:id (hard delete with organizer scoping when provided, archive fallback via status=Cancelled on FK conflict)
- GET /api/notifications/:userId

Implemented frontend event functionality:
- Student dashboard lists/fetches events and supports client-side search/filter/sort
- Organizer dashboard fetches organizer events and supports remove-event action
- Dashboard UI/UX and responsive layout are implemented

### 3.3 Profile Management
Backend profile endpoints exist in data.js:
- GET /api/profile/:id
- PUT /api/profile/:id

Student profile support appears implemented end-to-end:
- frontend /profile fetches and updates student data
- backend PUT updates StudentProfiles including LinkedInURL/GitHubURL

Organizer profile is partially integrated:
- frontend /profileO submits organizer payload
- backend PUT /api/profile/:id currently updates StudentProfiles fields, not OrganizerProfiles fields
- this creates a role mismatch for organizer profile save

### 3.4 Team Features
Implemented backend:
- POST /api/teams/create -> calls sp_CreateTeam
- POST /api/teams/invite -> calls sp_InviteTeamMember

Team UI flow in frontend:
- not implemented as dedicated pages/forms yet

### 3.5 Database Model and SQL Assets
Implemented SQL assets:
- SQLschema.sql: complete schema creation script with constraints and post-schema alterations
- procedures.sql: operational procedures for register/update/profile/register-for-event/unregister/team/invite/cancel-event
- views.sql: vw_UpcomingEvents
- SQLdata.sql: sample seed data across major tables
- SQLQueries.sql: reference query set (documentation/utility style)

Notable schema coverage:
- Users + role-specific profile tables
- Interests and UserInterests
- Events + categories/tags mappings
- Registrations + waitlist + attendance
- Teams + team members
- Skills + achievements + certificates
- Notifications + preferences
- Reviews + organizer responses

### 3.6 Migration Utilities
Backend scripts implemented:
- migrate-passwords.js
  - dry-run default
  - --apply mode to hash non-bcrypt passwords
- migrate-profile-picture-column.js
  - ensures ProfilePictureURL columns are NVARCHAR(MAX)

## 4. Frontend Page Status

Implemented pages:
- / (landing page)
- /login
- /register
- /dashboard (student)
- /dashboardO (organizer)
- /profile (student)
- /profileO (organizer)

Referenced but missing pages:
- /events/new (linked from organizer dashboard, route not present)
- /events/[id] and /events/edit/[id] style links are used in organizer cards, but no matching routes currently exist in frontend/app/events

## 5. End-to-End Flows That Work Today

Likely working now:
1. Register student/organizer account
2. Login
3. Redirect to role-specific dashboard
4. Fetch and view events
5. Student profile fetch/update (basic)
6. Organizer dashboard event deletion request

Partially working / likely broken paths:
1. Organizer profile save (frontend payload vs backend student-only update logic)
2. Add Event flow from organizer dashboard (missing /events/new page)
3. Event detail/edit links from organizer dashboard (missing routes)
4. Event registration from student UI (backend exists, student dashboard currently only has View Details button with no register action)

## 6. Security and Quality Status

Implemented safeguards:
- bcrypt hashing for new users
- domain-restricted auth email checks
- DB-backed constraints and checks
- request payload size limit and friendly 413 response

Missing/weak areas:
- no JWT/session middleware protecting routes
- user identity is trusted from localStorage in frontend
- no rate limiting on auth and API endpoints
- limited validation/sanitization for URL/text fields
- no automated test suite (backend/frontend)
- no CI/CD pipeline or deployment automation

## 7. Data/Schema and Code Alignment Notes

Observed alignment:
- SQL schema includes LinkedInURL/GitHubURL for student profile and backend student profile update reads/writes them
- vw_UpcomingEvents shape supports student dashboard consumption
- procedures for registration/team flows match backend endpoint usage

Observed mismatch/gaps:
- organizer profile update path not aligned between frontend and backend logic
- frontend routes for create/edit/view event pages are referenced but absent
- root package.json only contains express dependency and does not orchestrate full monorepo scripts

## 8. Recommended Next Milestones

Priority 1 (functional completeness):
1. Implement organizer event creation page at /events/new and corresponding backend create endpoint if absent
2. Implement event detail and edit pages/routes referenced by organizer dashboard
3. Wire student event registration button to POST /api/events/register
4. Fix PUT /api/profile/:id to branch by role and update OrganizerProfiles correctly

Priority 2 (stability/security):
1. Add JWT/session auth middleware and protect sensitive endpoints
2. Add input validation layer (e.g., zod/joi) for all write endpoints
3. Add rate limiting and stricter CORS policy
4. Add backend API tests and basic frontend integration tests

Priority 3 (production readiness):
1. Add CI pipeline (lint/test/build)
2. Add deployment config and environment strategy
3. Add database migration/versioning workflow
4. Add observability/logging standards

## 9. LLM-Ready Context Block
Use the following block directly when prompting another LLM:

```markdown
Project: EventDhondo (campus event discovery + organizer operations)
Stack:
- Backend: Node.js + Express + mssql + bcrypt
- Frontend: Next.js 16 App Router + React 19 + Tailwind v4
- DB: SQL Server with schema/procedures/views scripts

Current state summary:
- Auth/register/login and role routing are implemented.
- Student and organizer dashboards exist and fetch events.
- Student profile fetch/update is implemented.
- Team creation/invite backend endpoints exist.
- Event registration/check-in/notifications backend endpoints exist.

Known gaps:
- Organizer profile update path is not correctly handled by backend PUT profile logic.
- /events/new, /events/[id], /events/edit/[id] frontend routes are referenced but missing.
- Student UI is not yet wired to call POST /api/events/register.
- No JWT/session middleware; security hardening and tests are pending.

High-priority next tasks:
1) Build missing event routes/pages in frontend.
2) Add backend event creation/update endpoints as needed.
3) Fix organizer profile update handling in backend.
4) Integrate registration CTA in student dashboard with backend endpoint.
5) Add route protection + validation + rate limiting.
```

## 10. Conclusion
The project has a strong functional base and clear domain coverage across frontend, backend, and SQL. It is already suitable for demos and iterative feature work. The remaining effort is concentrated in route completion, role-specific profile correctness, and production-grade security/testing.
