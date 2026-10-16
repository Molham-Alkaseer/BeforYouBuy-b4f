import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { CategoriesModule } from '../../src/categories/categories.module';
import { createValidationPipe } from '../../src/common/validation';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { WriteService } from '../../src/database/write.service';

describe('Categories HTTP with real MongoDB', () => {
  let app: INestApplication;
  let connection: Connection;
  let dairyId: number;
  const key = 'integration-only-key';
  const uri = `mongodb://127.0.0.1:27018/byb_test_categories_${process.pid}?replicaSet=byb-rs`;

  async function start() {
    const module = await Test.createTestingModule({ imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ INTERNAL_TOOL_KEY: key })] }),
      MongooseModule.forRoot(uri), CategoriesModule,
    ] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    connection = app.get(getConnectionToken());
  }
  beforeAll(start);
  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
  });

  it('lists publicly without exposing storage fields', async () => {
    await request(app.getHttpServer()).get('/api/categories').expect(200, { items: [] });
  });
  it.each([undefined, 'wrong'])('rejects mutations with key %s', async (header) => {
    for (const method of ['post', 'patch', 'delete'] as const) {
      const path = method === 'post' ? '/api/categories' : '/api/categories/1';
      const call = request(app.getHttpServer())[method](path);
      if (header) call.set('x-internal-tool-key', header);
      const response = await call.send({ name: 'Dairy' }).expect(403);
      expect(response.body).toMatchObject({ code: 'INTERNAL_TOOL_FORBIDDEN', fieldErrors: {} });
    }
  });
  it('creates a trimmed name and returns only the contract fields', async () => {
    const response = await request(app.getHttpServer()).post('/api/categories')
      .set('x-internal-tool-key', key).send({ name: ' Dairy ' }).expect(201);
    dairyId = response.body.id;
    expect(response.body).toEqual({ id: expect.any(Number), name: 'Dairy' });
  });
  it.each([{ name: ' ' }, { name: 3 }, { name: null }, {}, { name: 'A', extra: true }])('rejects invalid create input %j', async (body) => {
    const response = await request(app.getHttpServer()).post('/api/categories')
      .set('x-internal-tool-key', key).send(body).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.fieldErrors).length).toBeGreaterThan(0);
  });
  it('rejects normalized duplicate names', async () => {
    const response = await request(app.getHttpServer()).post('/api/categories')
      .set('x-internal-tool-key', key).send({ name: ' DAIRY ' }).expect(409);
    expect(response.body.code).toBe('DUPLICATE_CATEGORY_NAME');
  });
  it('rejects unknown query fields on every category route', async () => {
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const path = ['get', 'post'].includes(method) ? '/api/categories' : `/api/categories/${dairyId}`;
      const call = request(app.getHttpServer())[method](path + '?unexpected=1').set('x-internal-tool-key', key);
      if (['post', 'patch'].includes(method)) call.send({ name: 'Example' });
      const response = await call.expect(400);
      expect(response.body.fieldErrors.unexpected).toBeDefined();
    }
  });
  it('rejects empty PATCH, invalid IDs and unexpected delete bodies', async () => {
    await request(app.getHttpServer()).patch(`/api/categories/${dairyId}`).set('x-internal-tool-key', key).send({}).expect(400);
    for (const id of ['0', '-1', '1.5', '9007199254740992', 'abc']) {
      await request(app.getHttpServer()).delete('/api/categories/' + id).set('x-internal-tool-key', key).expect(400);
    }
    await request(app.getHttpServer()).delete(`/api/categories/${dairyId}`).set('x-internal-tool-key', key).send({ extra: true }).expect(400);
  });
  it('returns 404 for absent categories', async () => {
    const result = await request(app.getHttpServer()).delete('/api/categories/9999').set('x-internal-tool-key', key).expect(404);
    expect(result.body.code).toBe('CATEGORY_NOT_FOUND');
    await request(app.getHttpServer()).patch('/api/categories/9999').set('x-internal-tool-key', key).send({ name: 'Missing' }).expect(404);
  });
  it('blocks deletion of a category used by the pantry', async () => {
    await connection.collection('pantry_items').insertOne({ id: 1, categoryId: dairyId });
    const result = await request(app.getHttpServer()).delete(`/api/categories/${dairyId}`).set('x-internal-tool-key', key).expect(409);
    expect(result.body.code).toBe('CATEGORY_IN_USE');
  });
  it('renames and deletes an unused category with an empty 204 response', async () => {
    const created = await request(app.getHttpServer()).post('/api/categories').set('x-internal-tool-key', key).send({ name: 'Baking' }).expect(201);
    const path = `/api/categories/${created.body.id}`;
    await request(app.getHttpServer()).patch(path).set('x-internal-tool-key', key).send({ name: 'dairy' }).expect(409);
    await request(app.getHttpServer()).patch(path).set('x-internal-tool-key', key).send({ name: ' Baking supplies ' })
      .expect(200, { id: created.body.id, name: 'Baking supplies' });
    const deleted = await request(app.getHttpServer()).delete(path).set('x-internal-tool-key', key).expect(204);
    expect(deleted.text).toBe('');
  });
  it('allows only one of concurrent duplicate creates', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      request(app.getHttpServer()).post('/api/categories').set('x-internal-tool-key', key).send({ name: 'Drinks' })));
    expect(results.filter(result => result.status === 201)).toHaveLength(1);
    expect(results.filter(result => result.status === 409)).toHaveLength(7);
  });
  it('protects category deletion against a concurrent cooperating pantry writer', async () => {
    const created = await request(app.getHttpServer()).post('/api/categories').set('x-internal-tool-key', key).send({ name: 'Race category' });
    const id = created.body.id;
    await Promise.all([
      app.get(WriteService).run(async session => {
        const category = await connection.collection('categories').findOne({ id }, { session });
        if (category) await connection.collection('pantry_items').insertOne({ id: 2, categoryId: id }, { session });
      }),
      request(app.getHttpServer()).delete(`/api/categories/${id}`).set('x-internal-tool-key', key),
    ]);
    const item = await connection.collection('pantry_items').findOne({ categoryId: id });
    if (item) expect(await connection.collection('categories').findOne({ id })).not.toBeNull();
  });
  it('preserves categories after application restart', async () => {
    await app.close();
    await start();
    const response = await request(app.getHttpServer()).get('/api/categories').expect(200);
    expect(response.body.items).toContainEqual({ id: dairyId, name: 'Dairy' });
    expect(response.body.items.map(item => item.id)).toEqual([...response.body.items.map(item => item.id)].sort((a, b) => a - b));
  });
  it('documents the internal header on mutations only', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const hasKey = operation => operation.parameters?.some(parameter => parameter.name === 'x-internal-tool-key');
    expect(hasKey(document.paths['/api/categories'].get)).toBeFalsy();
    expect(hasKey(document.paths['/api/categories'].post)).toBe(true);
    expect(hasKey(document.paths['/api/categories/{id}'].patch)).toBe(true);
    expect(hasKey(document.paths['/api/categories/{id}'].delete)).toBe(true);
  });
});
