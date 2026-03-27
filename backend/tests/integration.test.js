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
  let enquiryId;
  let leadId;
  let auditorId;
  let auditorToken;

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
    auditorId = createUserRes.body.data._id;

    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' })
      .expect(201);

    customerId = custRes.body.data._id;

    const loanRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ loanId: 'LN-001', customer: customerId, amount: 5000, termMonths: 12 })
      .expect(201);

    expect(loanRes.body.data.loanId).toBe('LN-001');
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

  test('loan IDs must be unique', async () => {
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ loanId: 'LN-001', customer: customerId, amount: 7000, termMonths: 24 })
      .expect(400);
  });

  test('can create and fetch enquiries and leads', async () => {
    const enquiryRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        customerName: 'John Doe',
        email: 'john@example.com',
        phone: '9999999999',
        message: 'Need a rate quote',
      })
      .expect(201);

    expect(enquiryRes.body.data.customerId).toBe(customerId);
    enquiryId = enquiryRes.body.data.id;

    const enquiriesList = await request(app)
      .get('/api/enquiries')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(enquiriesList.body.data)).toBe(true);
    expect(enquiriesList.body.data.length).toBeGreaterThanOrEqual(1);

    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        businessName: 'Acme Traders',
        contactPerson: 'Priya',
        primaryPhone: '8888888888',
        city: 'Mumbai',
        sourcedBy: 'Website',
        loanType: 'Business Loans',
      })
      .expect(201);

    expect(leadRes.body.data.businessName).toBe('Acme Traders');
    leadId = leadRes.body.data.id;

    const leadsList = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(leadsList.body.data)).toBe(true);
    expect(leadsList.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('non-superusers cannot delete core CRM data', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auditor', password: 'password123' })
      .expect(200);

    auditorToken = loginRes.body.token;

    await request(app)
      .delete(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(403);

    await request(app)
      .delete(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(403);

    await request(app)
      .delete(`/api/enquiries/${enquiryId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(403);

    await request(app)
      .delete(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(403);
  });

  test('deleted users cannot keep using an old token', async () => {
    expect(auditorToken).toBeDefined();

    await request(app)
      .delete(`/api/users/${auditorId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(401);
  });
});
