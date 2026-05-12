# Client authentication integration

This document reflects the **current** stack: **Better Auth** on the **ERP Next.js app** for staff sign-in and session cookies, and **Express** verifying those sessions for `/api/*` using the same MongoDB database.

> **Historical note:** Older revisions described JWT access/refresh tokens and Passport Google routes on Express. Those flows are **not** what ships in `src/routes/auth.routes.js` today. Use this file and [../../docs/production-configuration.md](../../docs/production-configuration.md) as the source of truth.

---

## Components

| Piece | Responsibility |
|-------|----------------|
| **ERP (`erp-app`)** | `betterAuth()` in `src/lib/auth.ts`, route handler `src/app/api/auth/[...all]/route.ts`, client `src/lib/auth-client.ts`. Issues session cookies for the **ERP origin**. |
| **Backend (`backend`)** | `getBetterAuth()` in `src/betterAuth.js` (lazy init), `auth` middleware in `src/middlewares/auth.js` calls `auth.api.getSession({ headers })` so protected routes see `req.user`. |
| **MongoDB** | Shared: user/session tables used by both processes. **`BETTER_AUTH_SECRET` must be identical** in ERP and backend env. |

---

## API base URL and CORS

- ERP and ecommerce call the REST API with a configurable base URL, typically **`NEXT_PUBLIC_API_URL`**, which should end with **`/api`** (see each app’s README).
- Express enables **`credentials: true`** in CORS. In production, set **`CORS_ORIGIN`** to an explicit list of frontend origins (comma-separated). Do **not** use `*` when browsers send cookies or credentials.

---

## ERP → API requests

`erp-app/src/lib/api.ts` uses Axios with **`withCredentials: true`**. The browser attaches cookies the server is allowed to see according to **origin**, **SameSite**, and **Secure** rules. For cross-origin ERP (`:3000`) → API (`:4000`), you must align:

- **`CORS_ORIGIN`** including the ERP origin.
- Cookie **domain / SameSite** behavior for your deployment (localhost vs HTTPS vs IP).

Session validation on the API uses headers forwarded on each request (`fromNodeHeaders` in `auth.js`).

---

## Auth routes today

| App | Path | Role |
|-----|------|------|
| ERP (Next) | `/api/auth/*` | Better Auth handler (`toNextJsHandler`). Sign-in, sign-up, session, OAuth, etc. |
| Backend (Express) | `GET /api/auth/me` | Returns profile + `allowedSections` for RBAC (`auth.routes.js`). Requires valid Better Auth session (see middleware). |

There is **no** `POST /api/auth/login` on Express in the current router; staff login is handled by the ERP Better Auth UI and API routes.

---

## Protected API usage

1. User signs in on the **ERP** (Better Auth).
2. Browser calls **`GET /api/auth/me`** on the **backend** (with credentials as configured) to load role and section permissions into `AuthContext`.
3. Other **`/api/*`** calls use the same Axios instance; the **`auth`** middleware rejects unauthenticated requests with **401** and wrong roles with **403**.

---

## Google OAuth (ERP)

Configured in `erp-app/src/lib/auth.ts` with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Redirect URIs and Google console configuration must match the **public ERP URL** (`BETTER_AUTH_URL`).

---

## Ecommerce storefront

The storefront uses the public API for catalog/cart flows. It does not use the ERP Better Auth routes. Configure **`NEXT_PUBLIC_API_URL`** (and optional **`NEXT_PUBLIC_ECOMMERCE_SHIPPING_COST`**) per [../../docs/production-configuration.md](../../docs/production-configuration.md).

---

## Checklist for integrators

- [ ] Same **`BETTER_AUTH_SECRET`** on ERP and backend.
- [ ] **`BETTER_AUTH_URL`** on ERP (and backend `betterAuth`) matches how users open the ERP in the browser.
- [ ] **`CORS_ORIGIN`** lists every frontend origin that calls the API with credentials.
- [ ] **`MONGO_URI`** points at one shared database for API data and Better Auth collections.
- [ ] For production TLS, review cookie **`Secure`** and **SameSite** requirements for your domains.

---

## Code map

| Area | Location |
|------|----------|
| ERP Better Auth config | `erp-app/src/lib/auth.ts` |
| ERP auth route | `erp-app/src/app/api/auth/[...all]/route.ts` |
| ERP auth client | `erp-app/src/lib/auth-client.ts` |
| Backend Better Auth singleton | `backend/src/betterAuth.js` |
| Required session + roles | `backend/src/middlewares/auth.js` |
| Optional session | `backend/src/middlewares/optionalAuth.js` |
| `/api/auth/me` | `backend/src/routes/auth.routes.js` |
| CORS | `backend/src/app.js` |
