import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { findOperatorKey } from '../../src/middleware/rejectMongoOperators';

let app: any;
let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  await mongoose.connect(mongo.getUri());
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('findOperatorKey', () => {
  it('encuentra operadores a cualquier profundidad, también dentro de listas', () => {
    expect(findOperatorKey({ status: { $ne: 'x' } })).toBe('$ne');
    expect(findOperatorKey({ a: [{ b: { $where: '1' } }] })).toBe('$where');
    expect(findOperatorKey({ $or: [] })).toBe('$or');
  });

  it('deja pasar valores con "$" y datos normales', () => {
    expect(findOperatorKey({ q: '$100', price: 900, tags: ['a', '$b'], nested: { x: null } })).toBeNull();
    expect(findOperatorKey(undefined)).toBeNull();
    expect(findOperatorKey('texto')).toBeNull();
    expect(findOperatorKey(Buffer.from('{"$ne":1}'))).toBeNull();
  });
});

describe('rejectMongoOperators en la app', () => {
  it('rechaza un operador en el cuerpo del login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_input');
  });

  it('rechaza un operador en la query', async () => {
    const res = await request(app).get('/api/properties?status[$ne]=archived');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_input');
  });

  it('las peticiones normales siguen funcionando', async () => {
    const list = await request(app).get('/api/properties?q=%24100&city=Madrid');
    expect(list.status).toBe(200);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.org', password: 'x' });
    expect(login.status).toBe(400);
    expect(login.body.error).toBeUndefined();
  });
});
