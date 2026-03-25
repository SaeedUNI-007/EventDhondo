# EventDhondo Project Progress Report

Last verified: 2026-03-26

## 1. Executive Summary
EventDhondo is a campus event discovery and management platform with this monorepo structure:
- backend: Express API + SQL Server access
- frontend: Next.js app (App Router)
- database: SQL schema, procedures, views, seed data

Current maturity (estimated):
- Core platform foundation: complete
- Student/organizer authentication and role routing: complete
- Event discovery and registration lifecycle: mostly complete
- Organizer event management (create/delete/view): complete for main flow
- Profile management (student + organizer): complete for main flow
- Admin dashboard backend coverage: partially complete
- Production hardening (security, tests, CI/CD): pending

Overall: project appears around 80-85% feature-complete for demo use, with remaining work focused on admin APIs and production hardening.

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
- State/data: sessionStorage-first auth + localStorage fallback/cache

### Database
- Engine: Microsoft SQL Server
- Setup model: SQL-first scripts (schema/procedures/views/data)
- Domain model: users, roles, events, registrations, waitlists, attendance, teams, notifications, reviews, achievements

## 3. Major Progress Completed This Sprint

### 3.1 Dependency and Runtime Fixes
- Fixed frontend module resolution issue for charts (Chart.js/react-chartjs-2 stack).
- Updated lockfile and dependency state to match imports.
- Stabilized backend env loading by resolving .env from backend directory path.

### 3.2 Backend API Enhancements Completed
Implemented in backend/data.js:
- POST /api/events
  - organizer event creation
  - date/time normalization and validation
  - registration deadline validation against event date
  - organizer profile existence pre-check
- POST /api/events/register
  - improved success/error handling and waitlist message handling
- POST /api/events/unregister
  - integrated with existing SQL procedure sp_UnregisterFromEvent
- GET /api/events/registrations/:userId
  - returns student registration list with event details
- DELETE /api/events/:id
  - hard-delete if safe; archive-to-cancelled fallback on FK conflicts

Existing core endpoints retained and in use:
- GET /api/events
- GET /api/interests
- GET/PUT /api/profile/:id
- GET /api/notifications/:userId
- PUT /api/admin/verify-organizer/:id

### 3.3 Frontend-Backend Integration Completed
Connected key pages to real backend APIs:
- Student/organizer dashboards now fetch from API events
- Organizer event creation page now saves to backend instead of local-only storage
- Register event page now calls backend register endpoint
- View event page now supports unregister via backend
- Organizer remove/view pages use backend delete/fetch flows
- Profile pages (student + organizer) fetch and save via backend profile APIs
- Admin verification page wired to backend verify endpoint and profile/user data fetching

### 3.4 Session Isolation (Multi-Account Tabs) Completed
Rolled out sessionStorage-first auth identity handling across app pages:
- Login now stores active session in sessionStorage
- App pages read userId/userRole/email/displayName from sessionStorage first
- localStorage kept as compatibility fallback and scoped profile cache

Result:
- Different browser tabs can remain logged into different accounts (tab-scoped sessions).

### 3.5 UI/Behavior Fixes Completed
- Corrected event date/time display formatting (removed raw ISO artifacts in key views).
- Removed seat-count requirement from student registration UI (single-seat flow).
- Added unregister action in event detail flow.
- Corrected requests tab behavior to show event requests rather than registration notifications.

## 4. Current Feature Status

### 4.1 Working End-to-End Flows
1. Register student/organizer account
2. Login and role-based dashboard redirect
3. Discover events (student)
4. Create event (organizer)
5. Delete/archive event (organizer)
6. Register/unregister for event (student)
7. Student and organizer profile fetch/update
8. Admin organizer approval (verify)
9. Notifications fetch

### 4.2 Backend Features Implemented But Lightly Exposed in UI
- Team management APIs:
  - POST /api/teams/create
  - POST /api/teams/invite
- QR check-in:
  - POST /api/events/check-in

## 5. Remaining Work (Accurate as of 2026-03-26)

### 5.1 Missing Admin API Coverage
1. GET /api/admin/stats (used by admin overview)
2. GET /api/admin/recent-activity (used by admin overview)
3. GET /api/admin/requests (used by admin requests page)
4. PUT /api/admin/cancel-event (admin event cancel action)
5. PUT /api/admin/reject-organizer/:id (currently UI-only behavior)

### 5.2 Security and Production Hardening
1. Add auth middleware (JWT/session) for protected routes
2. Enforce server-side authorization by role/ownership
3. Add request validation on write endpoints
4. Add rate limiting for auth and critical APIs
5. Tighten CORS policy

### 5.3 Quality and Operations
1. Add backend tests (unit + integration for procedures/endpoints)
2. Add frontend integration/smoke tests
3. Add CI pipeline (lint/test/build)
4. Add backend npm scripts for start/dev/test workflow consistency

## 6. Updated Risk/Gap Notes
- Admin dashboard still relies partly on fallback/mock data due to missing admin endpoints.
- Identity still depends on client-held storage; no signed server session yet.
- Test automation and CI are still absent.

## 7. Conclusion
The project moved from partial integration to a working full-stack event lifecycle for the primary student/organizer journeys. The biggest completed milestones were backend event-create/register/unregister coverage, organizer workflow wiring, and tab-isolated session handling across the app. The remaining backend work is concentrated in admin reporting/action endpoints and production-grade security/testing.
