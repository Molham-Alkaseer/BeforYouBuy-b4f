# Verification

From api/:

- `npm run db:start`: start the local replica set required by integration tests.
- `npm test -- --runInBand`: run all integration and foundation tests.
- `npm run test:unit`: shared validation, IDs-as-input, error safety and date checks without MongoDB.
- `npm run build`: compile the API.
- `node scripts/verify-db-restart.cjs`: verify disk persistence through an actual restart of the task-owned mongod.
- `npm run db:measure`: compile and measure a representative category/expiry query.

The integration suites create disposable byb_test_* databases on port 27018. They cover category HTTP behavior, auth, field validation, concurrency, IDs, transaction rollback, atomic seed, startup and application restart. They do not claim the unimplemented pantry/shopping/dashboard endpoints work.

See ../../docs/integration-results.md for pass results and team dependencies.
