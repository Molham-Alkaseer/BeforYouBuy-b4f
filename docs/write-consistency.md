# Shared database write contract

DatabaseModule owns model registration. Domains import DatabaseModule and inject their models; they never import another domain service. It imports each owner's schema file. The scaffold does not yet export PantryItemSchema or ShoppingEntrySchema: those registrations are deliberately omitted with a startup warning until the owners supply them. This is an explicit integration gap, not a replacement domain implementation.

## Local database

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File api/scripts/start-local-mongo.ps1
```

This starts a separate, localhost-only single-node replica set on port 27018 and stores data in ignored api/.local/mongo-rs. It does not change the existing MongoDB Windows service on 27017. The script accepts -MongoExe for a different installation path. Set MONGODB_URI=mongodb://127.0.0.1:27018/before_you_buy?replicaSet=byb-rs in api/.env. Transactions require a replica set; a standalone instance is not supported for mutations.

## Required integration by Mustafa and Allaith

Inject WriteService and wrap EVERY domain mutation in writes.run(async session => ...). Pass that SAME session to every participating read and write, including existence checks and category references. Allocate numeric IDs with IdsService.next before entering the callback. Failed operations can leave gaps, but IDs must never be reused.

The helper starts a transaction and updates one shared household fence document before business reads. MongoDB retries conflicting transactions, so deletion checks and new references cannot race when all writers use this protocol. The fence intentionally serializes mutations for this small household application. A transaction alone without the shared fence would not protect cross-collection check/write races.

Inside the callback:
- Use sequential awaits, not Promise.all for session operations.
- Re-read current state and perform business validations there.
- Update stock and purchase/history in the same transaction.
- Return the response data; log success only after run resolves.
- Do not send external messages, allocate IDs or perform other non-transactional side effects: callbacks can execute more than once.
- Never nest writes.run calls. Helpers should accept the existing session.

For a Mongoose query use .session(session); for save use save({ session }); for native collections pass { session }.

Tested against real MongoDB: 50 concurrent ID allocations, deleted IDs not reused, IDs survive reconnect, rollback after an injected purchase failure, concurrent read/modify/write serialization, and paired stock/history commit. These tests establish the helper's behavior, not that unfinished domain endpoints already use it.

## Owner handoff

Mustafa: export PantryItemSchema, register via DatabaseModule, use WriteService for create/update/use/delete and category reference checks.
Allaith: export ShoppingEntrySchema with all persisted contract fields, register via DatabaseModule, use WriteService for generate/create/purchase/delete.
Both: add business-specific race/failure tests and verify stock/history behavior using the shared helper.
