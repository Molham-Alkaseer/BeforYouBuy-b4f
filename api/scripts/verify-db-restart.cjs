const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { MongoClient } = require('mongodb');

(async () => {
  const uri = 'mongodb://127.0.0.1:27018/?replicaSet=byb-rs';
  const expectedPath = path
    .resolve(__dirname, '../.local/mongo-rs')
    .toLowerCase();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
  const databaseName = 'byb_test_restart_' + process.pid;
  const marker = { id: 1, value: 'persisted-' + Date.now() };
  try {
    await client.connect();
    const admin = client.db('admin');
    const options = await admin.command({ getCmdLineOpts: 1 });
    const actualPath = path
      .resolve(options.parsed.storage.dbPath)
      .toLowerCase();
    if (
      actualPath !== expectedPath ||
      options.parsed.replication.replSet !== 'byb-rs'
    ) {
      throw new Error(
        'Refusing to restart a MongoDB instance outside the task-owned local replica set.',
      );
    }
    await client
      .db(databaseName)
      .collection('persistence_check')
      .insertOne({ ...marker });
    try {
      await admin.command({ shutdown: 1 });
    } catch (error) {
      if (
        !['MongoNetworkError', 'MongoServerSelectionError'].includes(error.name)
      )
        throw error;
    }
  } finally {
    await client.close();
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const restart = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.resolve(__dirname, 'start-local-mongo.ps1'),
    ],
    { windowsHide: true, encoding: 'utf8', timeout: 60000 },
  );
  if (restart.status !== 0)
    throw new Error(restart.stderr || restart.stdout || 'Restart failed.');
  const restarted = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await restarted.connect();
    const stored = await restarted
      .db(databaseName)
      .collection('persistence_check')
      .findOne({ id: 1 });
    if (!stored || stored.value !== marker.value)
      throw new Error('Persistence check failed.');
    const report = {
      measuredAt: new Date().toISOString(),
      result: 'PASS',
      verification:
        'Persisted a marker, gracefully shut down the task-owned mongod, restarted it from the same data directory, and verified the unchanged marker.',
      database: databaseName,
      existingWindowsService: 'Not modified; test instance uses port 27018.',
    };
    fs.writeFileSync(
      path.resolve(__dirname, '../../docs/restart-evidence.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify(report, null, 2));
    await restarted.db(databaseName).dropDatabase();
  } finally {
    await restarted.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
