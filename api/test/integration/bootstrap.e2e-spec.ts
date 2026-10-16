import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { createValidationPipe } from '../../src/common/validation';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

describe('Full application bootstrap', () => {
  let app: INestApplication;
  let connection: Connection;
  const original = {
    MONGODB_URI: process.env.MONGODB_URI,
    SEED_ON_START: process.env.SEED_ON_START,
  };

  beforeAll(async () => {
    process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/byb_test_bootstrap_${process.pid}?replicaSet=byb-rs`;
    process.env.SEED_ON_START = 'true';
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    connection = app.get(getConnectionToken());
  });
  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('starts all current modules and seeds before handling requests', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/categories')
      .expect(200);
    expect(response.body.items).toHaveLength(7);
    expect(response.body.items[0]).toEqual({ id: 1, name: 'Dairy' });
    expect(await connection.collection('pantry_items').countDocuments()).toBe(
      20,
    );
  });

  it('normalizes unknown-route errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/nonexistent')
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.any(String),
      fieldErrors: {},
    });
  });
});
