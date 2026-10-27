// Starts and stops only its own isolated MongoDB and API child processes.
const fs = require('fs');
const path = require('path');
const net = require('net');
const assert = require('assert/strict');
const { spawn, execFileSync } = require('child_process');
const { randomBytes } = require('crypto');
const { MongoClient, BSON } = require('mongodb');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
async function waitFor(check, description) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if (await check()) return; } catch { /* process not ready */ }
    await delay(500);
  }
  throw new Error('Timed out waiting for ' + description);
}
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 'owned child process to stop');
}

(async () => {
  const mongoExe = process.env.MONGO_EXE || 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe';
  if (!fs.existsSync(mongoExe)) throw new Error('Set MONGO_EXE to your installed mongod executable.');
  const mongoPort = await freePort();
  const apiPort = await freePort();
  const folder = path.resolve(__dirname, '../.local/auth-restart-' + process.pid + '-' + Date.now());
  fs.mkdirSync(folder, { recursive: true });
  const database = 'byb_test_auth_restart';
  const uri = `mongodb://127.0.0.1:${mongoPort}/${database}?replicaSet=byb-auth-restart`;
  const directUri = `mongodb://127.0.0.1:${mongoPort}/?directConnection=true`;
  const env = { ...process.env, MONGODB_URI: uri, PORT: String(apiPort), SEED_ON_START: 'true', JWT_SECRET: randomBytes(48).toString('hex') };
  let mongo, api, client;
  const startMongo = () => {
    mongo = spawn(mongoExe, ['--dbpath', folder, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--replSet', 'byb-auth-restart', '--logpath', path.join(folder, 'mongo.log'), '--logappend'], { windowsHide: true, stdio: 'ignore' });
  };
  const connect = async () => {
    await waitFor(async () => {
      const probe = new MongoClient(directUri, { serverSelectionTimeoutMS: 400 });
      try { await probe.connect(); return (await probe.db('admin').command({ ping: 1 })).ok; }
      finally { await probe.close(); }
    }, 'isolated mongod');
    const direct = await MongoClient.connect(directUri);
    try {
      try { await direct.db('admin').command({ replSetGetStatus: 1 }); }
      catch (error) {
        if (error.code !== 94) throw error;
        await direct.db('admin').command({ replSetInitiate: { _id: 'byb-auth-restart', members: [{ _id: 0, host: `127.0.0.1:${mongoPort}` }] } });
      }
      await waitFor(async () => (await direct.db('admin').command({ hello: 1 })).isWritablePrimary, 'replica-set primary');
    } finally { await direct.close(); }
    client = await MongoClient.connect(uri);
  };
  const startApi = async () => {
    api = spawn(process.execPath, ['dist/main.js'], { cwd: path.resolve(__dirname, '..'), env, windowsHide: true, stdio: 'ignore' });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${apiPort}/api/categories`)).ok, 'isolated API');
  };
  let token;
  const call = async (method, route, body, status = 200) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, status, method + ' ' + route);
    return status === 204 ? undefined : response.json();
  };
  const snapshot = async () => {
    const data = {};
    for (const name of ['categories', 'pantry_items', 'shopping_entries', 'users', 'household_members', 'id_counters']) {
      data[name] = await client.db().collection(name).find().sort({ _id: 1 }).toArray();
    }
    return BSON.EJSON.stringify(data, { relaxed: false });
  };
  try {
    startMongo(); await connect(); await startApi();
    const credentials = { email: 'restart@example.com', password: randomBytes(24).toString('hex') };
    const registered = await call('POST', '/auth/register', { ...credentials, name: 'Restart verifier' }, 201);
    assert.equal(registered.householdRole, 'admin');
    assert.ok(registered.householdId > 1);
    token = (await call('POST', '/auth/login', credentials)).accessToken;
    assert.equal((await call('GET', '/pantry')).total, 0);
    const item = await call('POST', '/pantry', { name: 'Restart item', categoryId: 1, quantity: 2, minimumQuantity: 3, unit: 'boxes' }, 201);
    await call('POST', `/pantry/${item.id}/use`, { quantity: 1 });
    await call('POST', '/shopping-list/generate');
    const pending = await call('GET', '/shopping-list?status=Pending&pantryItemId=' + item.id);
    await call('POST', `/shopping-list/${pending.items[0].id}/purchase`, { purchasedQuantity: 4 });
    execFileSync(process.execPath, ['dist/database/set-household-role.js', credentials.email, 'member'], { cwd: path.resolve(__dirname, '..'), env, windowsHide: true, stdio: 'pipe' });
    await call('DELETE', '/pantry/' + item.id, undefined, 403);
    await call('POST', '/shopping-list/generate', undefined, 403);
    // Exercise the explicit operator command with the existing registered account.
    execFileSync(process.execPath, ['dist/database/set-household-role.js', credentials.email, 'admin'], { cwd: path.resolve(__dirname, '..'), env, windowsHide: true, stdio: 'pipe' });
    assert.equal((await call('GET', '/auth/me')).householdRole, 'admin');
    const before = await snapshot();
    await stopChild(api);
    const options = await client.db('admin').command({ getCmdLineOpts: 1 });
    assert.equal(path.resolve(options.parsed.storage.dbPath), folder);
    assert.equal(options.parsed.net.port, mongoPort);
    try { await client.db('admin').command({ shutdown: 1 }); }
    catch (error) { if (!['MongoNetworkError', 'MongoServerSelectionError'].includes(error.name)) throw error; }
    await client.close(); client = null;
    await waitFor(() => mongo.exitCode !== null || mongo.signalCode !== null, 'isolated MongoDB shutdown');
    startMongo(); await connect(); await startApi();
    assert.equal(await snapshot(), before, 'Domain data, accounts, memberships and IDs survive restart unchanged');
    assert.equal((await call('GET', '/auth/me')).id, registered.id, 'The original JWT still authenticates');
    assert.equal((await call('GET', '/pantry/' + item.id)).quantity, 5);
    const history = await call('GET', '/shopping-list?status=Purchased&pantryItemId=' + item.id);
    assert.equal(history.items[0].purchasedQuantity, 4);
    await call('DELETE', '/pantry/' + item.id, undefined, 204);
    assert.equal((await call('GET', '/shopping-list?status=Purchased&pantryItemId=' + item.id)).items[0].name, 'Restart item');
    const report = { measuredAt: new Date().toISOString(), result: 'PASS', database, checks: ['Registration creates an admin in a separate empty household', 'Login/use/generate/purchase through HTTP', 'Member delete and generate denied; CLI demotion/promotion takes effect with the same JWT', 'Owned API and mongod processes both restarted', 'Categories, stock, purchase history, users, memberships and ID counters unchanged across restart', 'Original JWT authenticates after restart; admin delete preserves purchase snapshot'], sharedMongoOn27018: 'Not restarted or modified by this script' };
    fs.writeFileSync(path.resolve(__dirname, '../../docs/household-restart-evidence.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await stopChild(api);
    if (client) { await client.db().dropDatabase(); await client.close(); }
    await stopChild(mongo);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
