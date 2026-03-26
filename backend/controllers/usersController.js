const User = require('../models/User');

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

async function ensureSuperuserRemains(targetUser, nextRole) {
  const removingSuperuser = targetUser.role === 'superuser' && nextRole !== 'superuser';
  if (!removingSuperuser) {
    return '';
  }

  const remainingSuperusers = await User.countDocuments({
    role: 'superuser',
    _id: { $ne: targetUser._id },
  });

  return remainingSuperusers === 0 ? 'At least one superuser must remain.' : '';
}

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1, name: 1 });
    res.json({ success: true, data: users.map(toPublicUser) });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const role = req.body.role || 'user';

    const duplicate = await User.findOne({ $or: [{ username }, { email }] });
    if (duplicate) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }

    const user = await User.create({
      username,
      password,
      name,
      email,
      role,
    });

    res.status(201).json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const username = (req.body.username || user.username).trim();
    const name = (req.body.name || user.name).trim();
    const email = (req.body.email || user.email).trim().toLowerCase();
    const role = req.body.role || user.role;
    const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';

    const duplicate = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ username }, { email }],
    });
    if (duplicate) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }

    const superuserError = await ensureSuperuserRemains(user, role);
    if (superuserError) {
      return res.status(400).json({ message: superuserError });
    }

    user.username = username;
    user.name = name;
    user.email = email;
    user.role = role;
    if (password) {
      user.password = password;
    }

    await user.save();

    res.json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot delete the currently signed-in user.' });
    }

    const superuserError = await ensureSuperuserRemains(user, 'deleted');
    if (superuserError) {
      return res.status(400).json({ message: superuserError });
    }

    await user.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const password = (req.body.password || '').trim();
    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    user.password = password;
    await user.save();

    res.json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};
