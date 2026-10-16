const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(
    'mongodb://127.0.0.1:27018/?directConnection=true',
    { serverSelectionTimeoutMS: 2000 },
  );
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await client.connect();
        break;
      } catch (error) {
        if (attempt === 15) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    const admin = client.db('admin');
    try {
      const config = await admin.command({ replSetGetConfig: 1 });
      if (config.config._id !== 'byb-rs')
        throw new Error('Port 27018 belongs to a different replica set.');
    } catch (error) {
      if (error.code !== 94) throw error;
      await admin.command({
        replSetInitiate: {
          _id: 'byb-rs',
          members: [{ _id: 0, host: '127.0.0.1:27018' }],
        },
      });
    }
    for (let attempt = 0; attempt < 30; attempt++) {
      const hello = await admin.command({ hello: 1 });
      if (hello.isWritablePrimary) {
        console.log('Local byb-rs replica set ready on port 27018.');
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Replica set did not elect a primary.');
  } finally {
    await client.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
