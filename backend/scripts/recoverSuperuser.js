require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] || fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function main() {
  const username = String(readArg('username')).trim();
  const email = normalizeEmail(readArg('email'));
  const password = String(readArg('password')).trim();
  const name = String(readArg('name', username || 'Superuser')).trim();
  const uri = process.env.MONGODB_URI || '';

  if (!uri) {
    throw new Error('MONGODB_URI is required.');
  }

  if (!username) {
    throw new Error('Pass --username <value>.');
  }

  if (!email) {
    throw new Error('Pass --email <value>.');
  }

  if (!password) {
    throw new Error('Pass --password <value>.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  const existing = await User.findOne({
    $or: [{ username }, { email }],
  }).select('+password');

  if (!existing) {
    const created = await User.create({
      username,
      email,
      password,
      name,
      role: 'superuser',
      isActive: true,
    });

    console.log(`Superuser created: ${created.username}`);
    return;
  }

  existing.username = username;
  existing.email = email;
  existing.password = password;
  existing.name = name;
  existing.role = 'superuser';
  existing.isActive = true;
  await existing.save();

  console.log(`Superuser updated: ${existing.username}`);
}

main()
  .catch((error) => {
    console.error('Superuser recovery failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
