import { MongoMemoryReplSet } from 'mongodb-memory-server';

module.exports = async () => {
  const replSet = (
    globalThis as unknown as { __MONGO_REPLSET__?: MongoMemoryReplSet }
  ).__MONGO_REPLSET__;
  if (replSet) {
    await replSet.stop();
  }
};
