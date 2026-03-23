# HOW IT WORKS: DocSpace

## 1) Architecture overview

DocSpace is split into two apps:

- `backend/`: NestJS API, Prisma ORM, MySQL database
- `frontend/`: React + Vite web app with Tailwind CSS

Core backend modules:

- `auth`: register/login/refresh/logout plus protected `me` route
- `tenant`: middleware that resolves tenant from `x-tenant-slug` or subdomain
- `prisma`: database service wrapper
- `common/filters`: global API exception formatting
- `collab`: tenant membership admin, invitations, teams, documents, ACL grants

Core frontend modules:

- `hooks/AuthProvider.tsx`: auth session state and persistence
- `hooks/useAuth.tsx`: consumer hook for auth context
- `api/client.ts`: typed request helpers and response parsing
- `pages/*`: login/register/dashboard pages
- `pages/MembersPage.tsx`: tenant role and membership operations
- `pages/InvitationsPage.tsx`: create/revoke invitation flows
- `pages/TeamsPage.tsx`: team CRUD and member management
- `pages/DocumentsPage.tsx`: document CRUD and ACL grant/revoke
- `pages/AcceptInvitationPage.tsx`: invite onboarding (`/invitations/accept?token=...`)

---

## 2) Request lifecycle

Every backend request flows like this:

1. Nest receives request under `/api/*`.
2. `TenantResolverMiddleware` attempts to resolve tenant by:
   - `x-tenant-slug` header (preferred), or
   - first subdomain from `Host`.
3. Controller route runs.
4. On protected routes:
   - `JwtAuthGuard` validates bearer token and attaches `request.authUser`.
   - `TenantMembershipGuard` ensures:
     - tenant context exists,
     - token tenant matches resolved tenant,
     - membership exists for user + tenant.
5. Response is returned.
6. Any thrown error is converted by `ApiExceptionFilter` into a uniform error payload:
   - `success: false`
   - `error.code`
   - `error.message`
   - `error.details` (optional)

---

## 3) Auth and token model

### Register

- Creates `User`.
- Creates `Tenant`.
- Creates owner `Membership`.
- Issues:
  - short-lived JWT access token
  - long-lived refresh token
- Stores refresh token as SHA-256 hash in DB (never raw token).

### Register from invite

- `POST /api/auth/register-from-invite` lets invited users join an existing tenant directly.
- Requires `email`, `password`, and invite `token`.
- Validates token and expiry, creates user, adds tenant membership from invite role, marks invite accepted, and returns normal auth payload.

### Login

- Looks up user by email.
- Verifies password with Argon2id.
- Resolves tenant by slug from request body.
- Ensures membership exists.
- Issues new access + refresh token pair.

### Refresh

- Hashes provided refresh token and finds DB record.
- Rejects invalid/expired/revoked tokens.
- Rotation behavior:
  - current refresh token is revoked,
  - new refresh token in same family is created.
- Replay detection:
  - if an already revoked token is reused, all active tokens in its family are revoked.

### Logout

- Protected endpoint (JWT + tenant + membership required).
- Revokes the submitted refresh token hash if active.
- Returns `{ success: true }`.

### Rate limiting

- Login route is guarded by in-memory limit:
  - max 5 attempts per 15 minutes per IP.

---

## 4) Data model (Phase 1)

Prisma models:

- `Tenant`: workspace identity (`slug`, plan, timestamps)
- `User`: global user identity (`email`, password hash)
- `Membership`: user-role inside tenant (`owner/admin/member/guest`)
- `RefreshToken`: hashed refresh token with family-based rotation metadata

Migration:

- `backend/prisma/migrations/20260323092332_init`

Seed:

- `backend/prisma/seed.ts` creates/updates:
  - tenant slug `acme` (default)
  - owner user `owner@acme.local` (default)
  - owner membership

Seed values are configurable through `.env`:

- `SEED_TENANT_SLUG`
- `SEED_TENANT_NAME`
- `SEED_USER_EMAIL`
- `SEED_USER_PASSWORD`

---

## 5) Frontend behavior

### Session model

- Auth payload (`accessToken`, `refreshToken`, `user`, `tenant`) is stored in localStorage as `docspace.session`.
- `AuthProvider` exposes `register`, `login`, `logout`, `isAuthenticated`, `session`.
- Protected route redirects unauthenticated users to `/login`.

### API error handling

- Frontend expects backend error contract and shows user-safe `error.message` in auth forms.
- Logout includes both:
  - `Authorization: Bearer <accessToken>`
  - `x-tenant-slug: <tenant.slug>`
  so protected backend checks pass.

### UI styling

- Tailwind CSS is configured with custom theme extension in `frontend/tailwind.config.ts`.
- Core pages restyled:
  - login card flow
  - registration card flow
  - dashboard summary card

---

## 6) Local run and validation

Backend:

```bash
cd backend
cp .env.example .env
pnpm install
pnpm db:setup
pnpm start:dev
```

Frontend:

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

Checks:

```bash
cd backend
pnpm lint
pnpm test
pnpm test:e2e

cd ../frontend
pnpm lint
pnpm build
```

---

## 7) Test coverage added in this phase

Backend e2e tests now validate:

- health endpoint
- full auth cycle
- refresh replay detection
- login rate limiting
- tenant + membership enforcement on protected route

This closes Phase 1 stabilization and prepares the codebase for Phase 2 features (RBAC, teams, invitations).

---

## 8) Phase 2 and 3 implementation started

Implemented backend capabilities:

- Role-based guard via `@RequireRole(...)` + `RoleGuard`
- Tenant member admin APIs (`list`, `update role`, `remove`)
- Invitation APIs:
  - create invitation with hashed token storage
  - invitation SMTP email delivery (when configured)
  - accept invitation by token
  - revoke invitation
- Team APIs:
  - create/list/update/delete team
  - add/remove team members
- Document APIs:
  - create/list/get/update/delete
  - grant/revoke direct user or team permissions
- ACL matrix e2e tests now cover owner/admin bypass, direct grants, team grants, and visibility fallback.

Permission resolver currently enforces:

1. tenant-scoped document lookup
2. owner/admin membership bypass
3. document owner bypass
4. direct user grant
5. team grant
6. visibility fallback (`tenant`, `team` for view-level access)

Remaining work for full Phase 2/3 completion:

- optional dedicated workspace management endpoints
