import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { createValidationPipe } from '../../src/common/validation';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { HouseholdRole } from '../../src/household-members/schemas/household-member.schema';

export const TEST_JWT_SECRET =
  'byb-integration-jwt-secret-at-least-32-characters';
export const TEST_PASSWORD = 'test-password-123';

export async function createAccount(
  app: INestApplication,
  role: HouseholdRole = 'member',
  householdId = 1,
) {
  const connection = app.get<Connection>(getConnectionToken());
  if (!connection.name.startsWith('byb_test_'))
    throw new Error('Auth fixtures require a disposable test database.');
  const email = randomUUID() + '@example.com';
  const registered = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ name: 'Test ' + role, email, password: TEST_PASSWORD })
    .expect(201);
  await connection
    .collection('household_members')
    .updateOne({ userId: registered.body.id }, { $set: { role, householdId } });
  const loggedIn = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return {
    id: registered.body.id as number,
    email,
    token: loggedIn.body.accessToken as string,
    user: loggedIn.body.user,
  };
}

export async function startAuthApp(suite: string) {
  const original = {
    MONGODB_URI: process.env.MONGODB_URI,
    SEED_ON_START: process.env.SEED_ON_START,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_TOOL_KEY: process.env.INTERNAL_TOOL_KEY,
  };
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/byb_test_${suite}_${process.pid}?replicaSet=byb-rs`;
  process.env.SEED_ON_START = 'true';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.INTERNAL_TOOL_KEY = 'byb-auth-test-internal-key';
  const { AppModule } = await import('../../src/app.module');
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  const connection = app.get<Connection>(getConnectionToken());
  return {
    app,
    connection,
    async stop() {
      await connection.dropDatabase();
      await app.close();
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}
