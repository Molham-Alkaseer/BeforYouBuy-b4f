// Local-only BSON-preserving snapshot. Never commit the resulting account data.
const fs = require('fs');
const path = require('path');
const { MongoClient, BSON } = require('mongodb');
const { parse } = require('dotenv');

(async () => {
  const envPath = path.resolve(__dirname, '../.env');
  const config = fs.existsSync(envPath) ? parse(fs.readFileSync(envPath)) : {};
  const uri = process.env.MONGODB_URI || config.MONGODB_URI;
  if (!uri || !/^mongodb:\/\/(127\.0\.0\.1|localhost):27018\//.test(uri)) {
    throw new Error('Backup requires the local development replica set on port 27018.');
  }
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const session = client.startSession();
  try {
    const db = client.db();
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const snapshot = { database: db.databaseName, capturedAt: new Date(), collections: {} };
    // Collection listing/index metadata are outside the transaction; document reads
    // share a snapshot. Do not run schema migrations concurrently with a backup.
    for (const { name } of collections) {
      snapshot.collections[name] = { indexes: await db.collection(name).indexes(), documents: [] };
    }
    await session.withTransaction(async () => {
      for (const { name } of collections) {
        snapshot.collections[name].documents = await db.collection(name).find({}, { session }).toArray();
      }
    }, { readConcern: { level: 'snapshot' } });
    const folder = path.resolve(__dirname, '../.local/backups');
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, 'before-tasks2-' + Date.now() + '.ejson');
    fs.writeFileSync(file, BSON.EJSON.stringify(snapshot, null, 2, { relaxed: false }), { flag: 'wx' });
    const verified = BSON.EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });
    if (Object.keys(verified.collections).length !== collections.length) throw new Error('Backup verification failed.');
    console.log('Local snapshot saved: ' + file);
    console.log('Collections: ' + collections.length + '; documents: ' + Object.values(snapshot.collections).reduce((sum, collection) => sum + collection.documents.length, 0));
  } finally { await session.endSession(); await client.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
