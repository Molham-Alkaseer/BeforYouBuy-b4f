// Run after npm run build. Uses a disposable database; never touches development data.
const fs = require('fs');
const path = require('path');
const { createConnection } = require('mongoose');
const { ConfigService } = require('@nestjs/config');
const { ClockService } = require('../dist/common/clock/clock.service');
const { WriteService } = require('../dist/database/write.service');
const { SeedService } = require('../dist/database/seed');

(async () => {
  const connection = await createConnection(
    'mongodb://127.0.0.1:27018/byb_test_index_' +
      process.pid +
      '?replicaSet=byb-rs',
  ).asPromise();
  try {
    const writes = new WriteService(connection);
    await writes.onModuleInit();
    await new SeedService(
      connection,
      writes,
      new ClockService(),
      new ConfigService(),
    ).seed();
    const collection = connection.collection('pantry_items');
    const query = { categoryId: 1 };
    const sort = { expiryDate: 1 };
    const summarize = (result) => ({
      returned: result.executionStats.nReturned,
      keysExamined: result.executionStats.totalKeysExamined,
      documentsExamined: result.executionStats.totalDocsExamined,
      executionTimeMs: result.executionStats.executionTimeMillis,
      winningPlan: result.queryPlanner.winningPlan,
    });
    const before = summarize(
      await collection.find(query).sort(sort).explain('executionStats'),
    );
    await collection.createIndex(
      { categoryId: 1, expiryDate: 1 },
      { name: 'category_expiry_candidate' },
    );
    const after = summarize(
      await collection.find(query).sort(sort).explain('executionStats'),
    );
    const hinted = summarize(
      await collection
        .find(query)
        .sort(sort)
        .hint('category_expiry_candidate')
        .explain('executionStats'),
    );
    const report = {
      measuredAt: new Date().toISOString(),
      database: 'Disposable fixture database, 20 pantry items',
      scope:
        'Representative stored-field query from the plan. Mustafa has not implemented the actual query yet.',
      query,
      sort,
      before,
      after,
      hinted,
      decision:
        "Do not add a production performance index yet. Repeat on Mustafa's implemented query and representative data. No speedup claim from millisecond-rounded timing on 20 records.",
    };
    const destination = path.resolve(
      __dirname,
      '../../docs/index-evidence.json',
    );
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
