# Shared database write contract

All current category, pantry and shopping mutations use the same WriteService and MongoDB session protocol.

DatabaseModule registers Category, PantryItem and ShoppingEntry from their owner schema files. It exports the models and aliases ClockService, IdsService and HouseholdWrites for Mustafa's code. It imports no domain service/module.

## Local setup

From api/: `npm run db:start`.

Set MONGODB_URI=mongodb://127.0.0.1:27018/before_you_buy?replicaSet=byb-rs. The localhost-only replica set is named byb-rs; its files are in ignored api/.local/mongo-rs. The existing Windows MongoDB service on 27017 is untouched.

## Protocol

Inject WriteService and call writes.run(async session => ...). The helper starts a transaction, then increments a shared household fence. Competing writes conflict and MongoDB retries them. A missing fence fails safely instead of bypassing serialization.

Pass the SAME session to every business read and write, including reference and deletion checks. Snapshot transactions alone cannot prevent write skew between different collections; the fence is required.

Inside the callback:
- Use sequential awaits, not parallel session operations.
- Read current state before validation.
- Commit stock and purchase/history in the same transaction.
- Never send external messages or perform nontransactional side effects.
- Do not nest writes.run calls.
- Return response data; log success only after run resolves.

Create endpoints normally allocate IDs before entering the callback. Gaps after failures are safe. Generation cannot know how many entries it needs before the transaction, so it calls IdsService.next(collection, session): all counter operations then participate in that SAME transaction. Failed generation rolls back its counter changes and created entries together. IDs belonging to committed/deleted records are never reused.

Use .session(session) on Mongoose queries, save({ session }) for document writes, and { session } for native operations.

## Verified behavior

The real-database suite covers concurrent use, use versus purchase, repeated purchases, generation versus manual naming, concurrent generation, deletion versus generation, guarded category deletion, rollback after a real purchase history-write failure, and failure when the fence is missing. It also covers ID concurrency, seed failure and application restart.

This deliberately serializes writes for one small household. If the application becomes multi-household or high-volume, fence partitioning would need a separate design; it is not required by this project.
