process.env.USE_IN_MEMORY_DB = 'true';
process.env.CORS_ORIGIN = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

require('../server');

const mongoose = require('mongoose');
const User = require('../models/User');

const localDefaults = {
  username: process.env.LOCAL_SUPERUSER_USERNAME || 'admin',
  password: process.env.LOCAL_SUPERUSER_PASSWORD || 'AdminLogin@123',
  name: process.env.LOCAL_SUPERUSER_NAME || 'Local Superuser',
  email: process.env.LOCAL_SUPERUSER_EMAIL || 'admin@myloancrm.local',
};

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      mongoose.connection.off('open', onOpen);
      mongoose.connection.off('error', onError);
    };

    mongoose.connection.on('open', onOpen);
    mongoose.connection.on('error', onError);
  });
}

async function ensureLocalSuperuser() {
  await waitForConnection();

  const existing = await User.findOne({
    $or: [
      { username: localDefaults.username },
      { email: localDefaults.email.toLowerCase() },
    ],
  }).select('+password');

  if (!existing) {
    await User.create({
      username: localDefaults.username,
      password: localDefaults.password,
      name: localDefaults.name,
      email: localDefaults.email.toLowerCase(),
      role: 'superuser',
      isActive: true,
    });

    console.log(`Local superuser ready: ${localDefaults.username} / ${localDefaults.password}`);
    return;
  }

  existing.username = localDefaults.username;
  existing.password = localDefaults.password;
  existing.name = localDefaults.name;
  existing.email = localDefaults.email.toLowerCase();
  existing.role = 'superuser';
  existing.isActive = true;
  await existing.save();

  console.log(`Local superuser refreshed: ${localDefaults.username} / ${localDefaults.password}`);
}

ensureLocalSuperuser().catch((error) => {
  console.error('Failed to seed local superuser:', error.message);
});
