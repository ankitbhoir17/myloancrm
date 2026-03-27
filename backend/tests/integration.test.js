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
  let lenderId;
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

    const lenderRes = await request(app)
      .post('/api/lenders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Axis Bank',
        status: 'Active',
      })
      .expect(201);

    lenderId = lenderRes.body.data.id;

    const loginRes = await request(app)
      .post(`/api/lenders/${lenderId}/logins`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        leadName: 'John Doe Login',
        surrogate: 'JD Home',
        status: 'Done',
        remarks: 'Created by superuser',
        product: 'home',
      })
      .expect(201);

    expect(loginRes.body.data.leadName).toBe('John Doe Login');
  });

  test('auditors can only view data created by themselves', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auditor', password: 'password123' })
      .expect(200);

    auditorToken = loginRes.body.token;

    const auditorCustomerRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ firstName: 'Asha', lastName: 'Patil', email: 'asha@example.com' })
      .expect(201);

    const auditorCustomerId = auditorCustomerRes.body.data.id;

    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ loanId: 'AUD-INVALID', customer: customerId, amount: 3000, termMonths: 12 })
      .expect(400);

    const auditorLoanRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ loanId: 'AUD-001', customer: auditorCustomerId, amount: 6000, termMonths: 18 })
      .expect(201);

    const auditorEnquiryRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        customerId: auditorCustomerId,
        customerName: 'Asha Patil',
        email: 'asha@example.com',
        phone: '7777777777',
        message: 'Need auditor scoped enquiry',
      })
      .expect(201);

    const auditorLeadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        businessName: 'Auditor Traders',
        contactPerson: 'Asha',
        primaryPhone: '7777777777',
        city: 'Pune',
        sourcedBy: 'Referral',
        loanType: 'Business Loans',
      })
      .expect(201);

    const auditorLenderRes = await request(app)
      .post('/api/lenders')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        name: 'Axis Bank',
        status: 'Active',
      })
      .expect(201);

    const auditorLenderId = auditorLenderRes.body.data.id;

    const auditorLoginRes = await request(app)
      .post(`/api/lenders/${auditorLenderId}/logins`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        leadName: 'Asha Login',
        surrogate: 'Auditor Case',
        status: 'Pending',
        remarks: 'Created by auditor',
        product: 'business',
      })
      .expect(201);

    const customersList = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(customersList.body.data).toHaveLength(1);
    expect(customersList.body.data[0].id).toBe(auditorCustomerId);

    const loansList = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(loansList.body.data).toHaveLength(1);
    expect(loansList.body.data[0].id).toBe(auditorLoanRes.body.data.id);

    const enquiriesList = await request(app)
      .get('/api/enquiries')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(enquiriesList.body.data).toHaveLength(1);
    expect(enquiriesList.body.data[0].id).toBe(auditorEnquiryRes.body.data.id);

    const leadsList = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(leadsList.body.data).toHaveLength(1);
    expect(leadsList.body.data[0].id).toBe(auditorLeadRes.body.data.id);

    const lendersList = await request(app)
      .get('/api/lenders')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(lendersList.body.data).toHaveLength(1);
    expect(lendersList.body.data[0].id).toBe(auditorLenderId);

    const lenderLogins = await request(app)
      .get(`/api/lenders/${auditorLenderId}/logins`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(lenderLogins.body.data).toHaveLength(1);
    expect(lenderLogins.body.data[0]._id).toBe(auditorLoginRes.body.data._id);

    await request(app)
      .get(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(404);

    await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(404);

    await request(app)
      .get(`/api/enquiries/${enquiryId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(404);

    await request(app)
      .get(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(404);

    await request(app)
      .get(`/api/lenders/${lenderId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(404);
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

  test('superusers can track auditor activities through the shared feed', async () => {
    const createActivityRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        type: 'loan_created',
        actor: 'auditor',
        message: 'Auditor created a loan entry',
        meta: { source: 'integration-test' },
      })
      .expect(201);

    expect(createActivityRes.body.data.actor).toBe('auditor');

    await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(403);

    const activitiesRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(activitiesRes.body.data)).toBe(true);
    expect(
      activitiesRes.body.data.some((item) => item.message === 'Auditor created a loan entry' && item.actor === 'auditor')
    ).toBe(true);
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
