const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });

const Lender = require('../models/Lender');
const Login = require('../models/Login');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/loancrm';
  console.log('Connecting to', uri);
  let mongod = null;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (connectErr) {
    console.warn('Failed to connect to provided MongoDB URI:', connectErr.message);
    console.warn('Falling back to an in-memory MongoDB for seeding (data will not persist).');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    console.log('Connecting to in-memory MongoDB at', memUri);
    await mongoose.connect(memUri);
  }

  try {
    console.log('Clearing existing demo lenders/logins (only those with metadata.seed=true)');
    await Login.deleteMany({ 'metadata.seed': true });
    await Lender.deleteMany({ 'metadata.seed': true });

    const lender = await Lender.create({
      name: 'HDFC BANK',
      image: '',
      status: 'New',
      metadata: { seed: true, legacyLenderId: 1 }
    });

    console.log('Created lender:', lender._id.toString(), lender.name);

    const legacyId = lender.metadata && lender.metadata.legacyLenderId ? lender.metadata.legacyLenderId : 1;
    const sampleLogins = [
      { lender: lender._id, leadName: 'Acme Enterprises', surrogate: 'Ramesh', loginDate: new Date('2026-02-10'), status: 'Done', remarks: 'Successful', product: 'business', metadata: { seed: true, legacyLenderId: legacyId } },
      { lender: lender._id, leadName: 'Bright Solutions', surrogate: 'Suresh', loginDate: new Date('2026-02-09'), status: 'Done', remarks: 'Successful', product: 'business', metadata: { seed: true, legacyLenderId: legacyId } },
      { lender: lender._id, leadName: 'Comfy Retail', surrogate: 'Anita', loginDate: new Date('2026-02-08'), status: 'Failed', remarks: 'Invalid docs', product: 'home', metadata: { seed: true, legacyLenderId: legacyId } },
    ];

    const created = await Login.insertMany(sampleLogins);
    console.log('Created logins:', created.map(c => c._id.toString()));

    console.log('Seed completed successfully. Lender ID:', lender._id.toString());
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await mongoose.disconnect();
    if (typeof mongod?.stop === 'function') await mongod.stop();
    process.exit(0);
  }
}

run();
