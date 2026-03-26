jest.setTimeout(30000);

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let app;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';

  // Require the server after setting MONGODB_URI
  app = require('../server');

  // Wait for mongoose to connect
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('open', resolve));
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Auth and basic APIs', () => {
  let token;
  let customerId;
  let loanId;

  test('register -> login -> create customer -> create loan -> fetch lists', async () => {
    const setupRes = await request(app)
      .get('/api/auth/setup-status')
      .expect(200);

    expect(setupRes.body.requiresSetup).toBe(true);

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password', name: 'Test User', email: 'test@example.com' })
      .expect(201);

    expect(regRes.body).toHaveProperty('token');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password' })
      .expect(200);

    token = loginRes.body.token;
    expect(token).toBeDefined();

    const usersList = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(usersList.body.data)).toBe(true);
    expect(usersList.body.data.length).toBe(1);

    const createUserRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'auditor', password: 'password123', name: 'Audit User', email: 'audit@example.com', role: 'auditor' })
      .expect(201);

    expect(createUserRes.body.data.username).toBe('auditor');

    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' })
      .expect(201);

    customerId = custRes.body.data._id;

    const loanRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer: customerId, amount: 5000, termMonths: 12 })
      .expect(201);

    loanId = loanRes.body.data._id;

    const loansList = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(loansList.body.data)).toBe(true);
    expect(loansList.body.data.length).toBeGreaterThanOrEqual(1);

    const customersList = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(customersList.body.data)).toBe(true);
    expect(customersList.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
