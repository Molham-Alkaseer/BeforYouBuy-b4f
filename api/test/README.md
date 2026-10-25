# Verification

From api/:

- `npm run db:start`: start the local replica set required by integration tests.
- `npm test -- --runInBand`: run all integration and foundation tests.
- `npm run test:unit`: shared validation, IDs-as-input, error safety and date checks without MongoDB.
- `npm run build`: compile the API.
- `node scripts/verify-auth-restart.cjs`: verify stock/history/accounts/memberships/counters through actual restarts of an isolated API and mongod; build first. The shared database on port 27018 stays running.
- `node scripts/backup-local.cjs`: save a private BSON-preserving snapshot of the configured local development DB under ignored `.local/backups`.
- `npm run db:measure`: compile and measure a representative category/expiry query.

Install dependencies in both `api/` and `client/` before running the full suite. Frontend adapter/session suites bundle the actual browser modules with the client's esbuild. Only Vite build-time environment values are replaced; live adapter tests still call real HTTP endpoints.

The integration suites create disposable `byb_test_*` databases on port 27018. Fixtures register/login real users, then promote only within these disposable databases. Final HTTP tests never override auth or role guards. AppModule test setups supply a test-only JWT secret and restore environment values afterward. The suite does not need or print the user's private secret.

Coverage includes the original 100 cases: categories, pantry, shopping, dashboard, strict input validation, ID continuity, concurrency, transactional purchases/generation, rollback, seed safety, startup, and the live frontend adapter. New cases cover post-commit shopping logs, safe users, bcrypt limits, duplicate-email races, atomic account/membership rollback, JWT verification, current/deleted accounts, the entire anonymous/member/admin/owner route matrix, category key independence, Swagger permissions, session restoration/races/expiry, safe return paths and explicit mock permissions.

The browser walkthrough separately checks real forms/navigation, purchase history, role controls, logout, keyboard activation and responsive layouts. It is not a complete accessibility audit or a substitute for each member's presentation. See [current integration evidence](../../docs/tasks2-integration.md) and [restart evidence](../../docs/tasks2-restart-evidence.json).
