# DocSpace Implementation Plan (Current)

## 1) Source of truth

This file reflects the current repository state and active decisions.

### Finalized stack

- Package manager: `pnpm`
- Backend folder: `backend/`
- Frontend folder: `frontend/`
- Backend framework: `NestJS + TypeScript`
- ORM: `Prisma`
- Database: `MySQL`
- Frontend: `React + Vite + TypeScript`
- Validation: `Zod`
- Password hashing: `Argon2id`
- UI styling: `Tailwind CSS`

---

## 2) What is already done

### Project setup

- [x] `backend/` scaffolded with NestJS (pnpm)
- [x] `frontend/` scaffolded with React + Vite TS (pnpm)
- [x] Root `.gitignore` added

### Backend foundation and Phase 1 completion

- [x] Environment schema validation (`zod`) added
- [x] Prisma base schema with:
  - [x] `Tenant`
  - [x] `User`
  - [x] `Membership`
  - [x] `RefreshToken`
- [x] Prisma initial migration normalized to `20260323092332_init`
- [x] Prisma seed script added (idempotent owner + tenant seed)
- [x] Prisma scripts aligned: generate, migrate, seed, `db:setup`
- [x] Auth endpoints implemented:
  - [x] `POST /api/auth/register`
  - [x] `POST /api/auth/register-from-invite`
  - [x] `POST /api/auth/login`
  - [x] `POST /api/auth/refresh`
  - [x] `POST /api/auth/logout`
  - [x] `GET /api/auth/me` (protected)
- [x] Refresh token rotation + replay-family revocation
- [x] Login rate limiting: 5 attempts per 15 minutes per IP
- [x] Tenant resolver middleware (`x-tenant-slug` / subdomain)
- [x] JWT + tenant membership guard chain on protected routes
- [x] Uniform API error response contract via global exception filter
- [x] Health route available (`GET /api/health`)

### Frontend foundation and Tailwind styling

- [x] Routing set up with `react-router-dom`
- [x] Auth context with local session persistence
- [x] Auth hook/provider split to satisfy Fast Refresh lint rule
- [x] API client wired to backend auth endpoints
- [x] API client updated for uniform backend error contract
- [x] API client sends tenant slug header for protected logout flow
- [x] Tailwind CSS configured in Vite project
- [x] Core pages restyled with Tailwind:
  - [x] Login
  - [x] Register
  - [x] Dashboard

### Testing and validation

- [x] Backend lint passes
- [x] Backend unit tests pass
- [x] Backend e2e suite added and passes:
  - [x] health success
  - [x] register -> login -> refresh -> logout
  - [x] refresh replay attack detection
  - [x] login rate limit
  - [x] tenant/membership protection checks
- [x] Frontend lint passes
- [x] Frontend production build passes (validated outside sandbox restrictions)

---

## 3) Public interface contract (active)

- Auth success payload remains unchanged:
  - `accessToken`
  - `refreshToken`
  - `user`
  - `tenant`
- Error payload is now uniform:
  - `success: false`
  - `error.code`
  - `error.message`
  - `error.details` (optional)
- Protected route policy:
  - valid bearer JWT required
  - tenant context required (`x-tenant-slug` or subdomain)
  - token tenant must match resolved tenant
  - active membership required

---

## 4) Phase 2 and 3 status

### Phase 2 (RBAC, invitations, teams)

- [x] Added tables: `workspaces`, `teams`, `team_members`, `invitations`
- [x] Role guard (`requireRole`) and owner self-demotion protection
- [x] Invitation issue/accept/revoke flow (hashed token storage)
- [x] Team CRUD and team membership management
- [x] Tenant member removal with permission cleanup cascade
- [x] Frontend tenant management UIs added:
  - [x] Members page
  - [x] Invitations page
  - [x] Teams page
- [x] Invitation email delivery workflow added (SMTP-backed; dev token still returned)
- [ ] Add dedicated workspace CRUD APIs (currently default workspace auto-provisioning is used)

### Phase 3 (document ACL + fine-grained permissions)

- [x] Added tables: `documents`, `document_permissions`
- [x] Implemented 5-layer permission resolver
- [x] Added document CRUD + visibility modes (`private`, `team`, `tenant`)
- [x] Added grant/revoke endpoints
- [x] Frontend documents + ACL management UI added
- [x] Frontend invitation onboarding page added (`/invitations/accept?token=...`)
- [x] ACL matrix e2e coverage added (owner/admin bypass, direct grants, team grants, visibility fallback)
- [ ] Expand endpoint-level e2e coverage for teams/invitations/documents and ACL matrix

---

## 5) Runbook (local)

### Prerequisites

- Node.js 20+
- pnpm 10+
- MySQL

### Backend

```bash
cd backend
cp .env.example .env
pnpm install
pnpm db:setup
pnpm start:dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

### Test commands

```bash
cd backend
pnpm lint
pnpm test
pnpm test:e2e

cd ../frontend
pnpm lint
pnpm build
```
