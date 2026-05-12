# Aslams — Backend API

Express 5 + Mongoose on MongoDB. Routes are mounted under **`/api`**. Protected routes use **Better Auth** session verification (`src/middlewares/auth.js`) against the same MongoDB database the ERP Next app uses for Better Auth.

## Documentation

- **Deploy & env (all services):** [../docs/production-configuration.md](../docs/production-configuration.md)
- **How browsers talk to the API today:** [docs/client_authentication_integration.md](./docs/client_authentication_integration.md)
- **CORS / cookies:** set `CORS_ORIGIN` to explicit origins in production (comma-separated); avoid `*` with credentialed cross-origin requests.

## Local setup

```bash
cd backend
# Create .env — see ../docs/production-configuration.md#backend-backendenv
npm install
npm run dev
```

Required **`backend/.env`** keys for a typical dev/prod run are listed in [../docs/production-configuration.md](../docs/production-configuration.md#backend-backendenv).

## Scripts

- `npm run dev` — development server (see `package.json` for the exact command).
- `node scripts/seed.js` — seed reference data (requires `MONGO_URI`).

## Tests

See `package.json` and `tests/` for Jest (or configured runner) usage.
