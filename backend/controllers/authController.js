const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function extractBearerToken(req) {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return req.headers.authorization.split(' ')[1];
  }

  return '';
}

async function getAuthenticatedUser(req) {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return await User.findById(decoded.id);
  } catch (error) {
    return null;
  }
}

// @desc    Get setup status
// @route   GET /api/auth/setup-status
// @access  Public
exports.getSetupStatus = async (req, res, next) => {
  try {
    const userCount = await User.countDocuments();
    res.json({
      success: true,
      requiresSetup: userCount === 0,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const existingUsers = await User.countDocuments();
    const actor = existingUsers > 0 ? await getAuthenticatedUser(req) : null;

    if (existingUsers > 0 && actor?.role !== 'superuser') {
      return res.status(403).json({ message: 'Registration is disabled. Ask a superuser to create users.' });
    }

    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const role = existingUsers === 0 ? 'superuser' : (req.body.role || 'user');

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      username,
      password,
      name,
      email,
      role,
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const identifier = (req.body.username || '').trim();
    const password = req.body.password || '';

    // Check if user exists
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() },
      ],
    }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};
