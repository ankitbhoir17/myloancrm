const mongoose = require('mongoose');
const Login = require('../models/Login');
const Lender = require('../models/Lender');
const { getDemoLoginsByLender } = require('../utils/demoLenderLogins');

function hasDatabaseConnection() {
  return mongoose.connection.readyState === 1;
}

// GET /api/lenders/:id/logins
exports.getLoginsByLender = async (req, res, next) => {
  const lenderId = req.params.id;

  if (!hasDatabaseConnection()) {
    return res.json({ success: true, data: getDemoLoginsByLender(lenderId), source: 'demo' });
  }

  try {
    // Accept either numeric localStorage-style id or Mongo ObjectId
    // If numeric, try to map to real lender by a `legacyId` in metadata; otherwise assume ObjectId
    let lender = null;
    if (/^[0-9a-fA-F]{24}$/.test(lenderId)) {
      lender = await Lender.findById(lenderId);
    } else {
      lender = await Lender.findOne({ 'metadata.legacyId': Number(lenderId) });
    }

    if (!lender) {
      // As a fallback, if numeric id (used in frontend localStorage), return logins matching metadata.legacyLenderId
      const maybeNum = Number(lenderId);
      if (!Number.isNaN(maybeNum)) {
        const items = await Login.find({ 'metadata.legacyLenderId': maybeNum }).sort('-loginDate');
        if (items.length === 0) {
          return res.json({ success: true, data: getDemoLoginsByLender(lenderId), source: 'demo' });
        }
        return res.json({ success: true, data: items });
      }
      return res.status(404).json({ message: 'Lender not found' });
    }

    const logins = await Login.find({ lender: lender._id }).sort('-loginDate');
    res.json({ success: true, data: logins });
  } catch (err) {
    if (!hasDatabaseConnection()) {
      return res.json({ success: true, data: getDemoLoginsByLender(lenderId), source: 'demo' });
    }
    next(err);
  }
};

// POST /api/lenders/:id/logins
exports.createLoginForLender = async (req, res, next) => {
  if (!hasDatabaseConnection()) {
    return res.status(503).json({ message: 'Database unavailable. Demo mode only supports viewing lender logins.' });
  }

  try {
    const lenderId = req.params.id;
    let lender = null;
    if (/^[0-9a-fA-F]{24}$/.test(lenderId)) {
      lender = await Lender.findById(lenderId);
    } else {
      lender = await Lender.findOne({ 'metadata.legacyId': Number(lenderId) });
    }
    if (!lender) return res.status(404).json({ message: 'Lender not found' });

    const payload = { ...req.body, lender: lender._id };
    const login = await Login.create(payload);
    res.status(201).json({ success: true, data: login });
  } catch (err) {
    next(err);
  }
};
