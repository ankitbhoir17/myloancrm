const Lender = require('../models/Lender');
const Login = require('../models/Login');
const { toOwnedPayload, withOwnedRecords } = require('../utils/ownership');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function toPublicLender(lender, summary = {}) {
  return {
    id: lender._id.toString(),
    _id: lender._id.toString(),
    createdBy: lender.createdBy ? String(lender.createdBy) : '',
    name: lender.name || '',
    image: lender.image || '',
    status: lender.status || 'Inactive',
    createdAt: formatDateOnly(lender.createdAt),
    metadata: lender.metadata || {},
    loginsCount: Number(summary.count || 0),
    lastLoginDate: summary.lastLoginDate || '',
    lastLoginStatus: summary.lastLoginStatus || '',
  };
}

async function buildLoginSummaryMap(req, lenders) {
  if (!Array.isArray(lenders) || lenders.length === 0) {
    return new Map();
  }

  const lenderIds = lenders.map((item) => item._id);
  const logins = await Login.find(withOwnedRecords(req, { lender: { $in: lenderIds } })).sort('-loginDate');
  const summaryMap = new Map();

  logins.forEach((login) => {
    const key = String(login.lender);
    const current = summaryMap.get(key) || {
      count: 0,
      lastLoginDate: '',
      lastLoginStatus: '',
    };

    current.count += 1;
    if (!current.lastLoginDate) {
      current.lastLoginDate = formatDateOnly(login.loginDate);
      current.lastLoginStatus = login.status || '';
    }

    summaryMap.set(key, current);
  });

  return summaryMap;
}

async function findDuplicateByName(req, name, excludeId = '') {
  if (!name) {
    return null;
  }

  const filter = withOwnedRecords(req, {
    name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
  });
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Lender.findOne(filter);
}

exports.createLender = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Lender name is required.' });
    }

    const duplicate = await findDuplicateByName(req, name);
    if (duplicate) {
      return res.status(400).json({ message: 'A lender with this name already exists.' });
    }

    const lender = await Lender.create(toOwnedPayload(req, {
      name,
      image: String(req.body.image || '').trim(),
      status: String(req.body.status || 'Inactive').trim() || 'Inactive',
      metadata: req.body.metadata || {},
    }));

    res.status(201).json({ success: true, data: toPublicLender(lender) });
  } catch (err) {
    next(err);
  }
};

exports.getLenders = async (req, res, next) => {
  try {
    const lenders = await Lender.find(withOwnedRecords(req)).sort('-createdAt');
    const summaryMap = await buildLoginSummaryMap(req, lenders);
    res.json({
      success: true,
      data: lenders.map((lender) => toPublicLender(lender, summaryMap.get(String(lender._id)))),
    });
  } catch (err) {
    next(err);
  }
};

exports.getLender = async (req, res, next) => {
  try {
    const lender = await Lender.findOne(withOwnedRecords(req, { _id: req.params.id }));
    if (!lender) {
      return res.status(404).json({ message: 'Not found' });
    }

    const summaryMap = await buildLoginSummaryMap(req, [lender]);
    res.json({ success: true, data: toPublicLender(lender, summaryMap.get(String(lender._id))) });
  } catch (err) {
    next(err);
  }
};

exports.updateLender = async (req, res, next) => {
  try {
    const lender = await Lender.findOne(withOwnedRecords(req, { _id: req.params.id }));
    if (!lender) {
      return res.status(404).json({ message: 'Not found' });
    }

    const name = String(req.body.name ?? lender.name).trim();
    if (!name) {
      return res.status(400).json({ message: 'Lender name is required.' });
    }

    const duplicate = await findDuplicateByName(req, name, lender._id);
    if (duplicate) {
      return res.status(400).json({ message: 'A lender with this name already exists.' });
    }

    lender.name = name;
    lender.image = String(req.body.image ?? lender.image ?? '').trim();
    lender.status = String(req.body.status ?? lender.status ?? 'Inactive').trim() || 'Inactive';
    lender.metadata = req.body.metadata ?? lender.metadata ?? {};
    await lender.save();

    const summaryMap = await buildLoginSummaryMap(req, [lender]);
    res.json({ success: true, data: toPublicLender(lender, summaryMap.get(String(lender._id))) });
  } catch (err) {
    next(err);
  }
};

exports.deleteLender = async (req, res, next) => {
  try {
    const lender = await Lender.findById(req.params.id);
    if (!lender) {
      return res.status(404).json({ message: 'Not found' });
    }

    await lender.deleteOne();
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
