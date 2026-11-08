import { MongoMemoryReplSet } from 'mongodb-memory-server';

module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  const uri = replSet.getUri();

  // Propagated to the test process; AppModule reads these via ConfigModule.
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-secret-at-least-16-characters-long';
  process.env.JWT_EXPIRES_IN = '3600s';
  process.env.LOAN_PERIOD_DAYS = process.env.LOAN_PERIOD_DAYS ?? '14';
  process.env.DAMAGE_CLAIM_WINDOW_HOURS =
    process.env.DAMAGE_CLAIM_WINDOW_HOURS ?? '48';
  // Relax throttling so functional tests are not rate-limited.
  process.env.THROTTLE_LIMIT = '100000';
  process.env.THROTTLE_AUTH_REGISTER_LIMIT = '100000';
  process.env.THROTTLE_AUTH_LOGIN_LIMIT = '100000';

  (globalThis as unknown as { __MONGO_REPLSET__: MongoMemoryReplSet }).__MONGO_REPLSET__ =
    replSet;
};
