// Run after npm run build. Only disposable test data is measured.
const fs = require('fs');
const path = require('path');
const { createConnection } = require('mongoose');
const { ConfigService } = require('@nestjs/config');
const { ClockService } = require('../dist/common/clock/clock.service');
const { WriteService } = require('../dist/database/write.service');
const { SeedService } = require('../dist/database/seed');
const { pantryStoredQuery } = require('../dist/pantry/pantry-query');

(async () => {
  const connection = await createConnection(
    'mongodb://127.0.0.1:27018/byb_test_index_' +
      process.pid +
      '?replicaSet=byb-rs',
  ).asPromise();
  try {
    const clock = new ClockService();
    const writes = new WriteService(connection);
    await writes.onModuleInit();
    await new SeedService(
      connection,
      writes,
      clock,
      new ConfigService(),
    ).seed();
    const collection = connection.collection('pantry_items');
    const input = { categoryId: 1, status: 'USE SOON' };
    const { filter, sort } = pantryStoredQuery(input, clock.today());
    const summarize = (result) => ({
      returned: result.executionStats.nReturned,
      keysExamined: result.executionStats.totalKeysExamined,
      documentsExamined: result.executionStats.totalDocsExamined,
      executionTimeMs: result.executionStats.executionTimeMillis,
      winningPlan: result.queryPlanner.winningPlan,
    });
    const explain = async () =>
      summarize(
        await collection.find(filter).sort(sort).explain('executionStats'),
      );
    const before = await explain();
    await collection.createIndex(
      { categoryId: 1, expiryDate: 1, id: 1 },
      { name: 'category_expiry_candidate' },
    );
    const candidate = await explain();
    const decision =
      'Keep only correctness indexes for the 20-item household workload. The candidate reduces examined documents, but this dataset does not establish a useful latency benefit. Re-evaluate if the data grows.';
    await collection.dropIndex('category_expiry_candidate');
    const afterDecision = await explain();
    const report = {
      measuredAt: new Date().toISOString(),
      database: 'Disposable fixture database, 20 pantry items',
      scope:
        'Actual pantryStoredQuery helper used by PantryService.findAll; category + USE SOON filter.',
      input,
      query: filter,
      sort,
      before,
      candidate,
      decision,
      afterDecision,
    };
    fs.writeFileSync(
      path.resolve(__dirname, '../../docs/index-evidence.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
