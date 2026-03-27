const Customer = require('../models/Customer');
const Loan = require('../models/Loan');

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function splitName(payload = {}) {
  const fullName = String(payload.name || '').trim();
  if (fullName) {
    const parts = fullName.split(/\s+/);
    return {
      firstName: parts.shift() || 'Customer',
      lastName: parts.join(' '),
    };
  }

  return {
    firstName: String(payload.firstName || '').trim() || 'Customer',
    lastName: String(payload.lastName || '').trim(),
  };
}

function buildCustomerName(customer) {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();
}

function toLoanSummary(loan) {
  return {
    id: loan._id.toString(),
    _id: loan._id.toString(),
    loanId: String(loan.loanId || '').trim(),
    type: loan.type || 'Personal',
    amount: Number(loan.amount || 0),
    status: loan.status || 'Leads',
    emi: Number(loan.emi || 0),
    date: loan.date || '',
    createdAt: loan.createdAt,
  };
}

function toPublicCustomer(customer, summary = {}, relatedLoans = null) {
  const loans = Array.isArray(relatedLoans) ? relatedLoans.map(toLoanSummary) : [];
  const loanCount = Array.isArray(relatedLoans) ? loans.length : Number(summary.loanCount || 0);
  const totalAmount = Array.isArray(relatedLoans)
    ? loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0)
    : Number(summary.totalAmount || 0);

  return {
    id: customer._id.toString(),
    _id: customer._id.toString(),
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    name: buildCustomerName(customer),
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
    status: customer.status || 'Active',
    joinDate: customer.joinDate || formatDateOnly(customer.createdAt),
    dateOfBirth: customer.dateOfBirth || '',
    occupation: customer.occupation || '',
    income: Number(customer.income || 0),
    panNumber: customer.panNumber || '',
    aadharNumber: customer.aadharNumber || '',
    loanCount,
    loans: Array.isArray(relatedLoans) ? loans : loanCount,
    totalAmount,
    documents: Array.isArray(customer.documents) ? customer.documents : [],
    activities: Array.isArray(customer.activities) ? customer.activities : [],
  };
}

async function buildLoanSummaryMap(customers) {
  const customerIds = customers.map((customer) => customer._id);
  if (customerIds.length === 0) {
    return new Map();
  }

  const relatedLoans = await Loan.find({ customer: { $in: customerIds } });
  const summaryMap = new Map();

  relatedLoans.forEach((loan) => {
    const key = String(loan.customer);
    const current = summaryMap.get(key) || { loanCount: 0, totalAmount: 0 };
    current.loanCount += 1;
    current.totalAmount += Number(loan.amount || 0);
    summaryMap.set(key, current);
  });

  return summaryMap;
}

function buildCustomerPayload(payload = {}, existingCustomer = null) {
  const { firstName, lastName } = splitName(payload);
  const createdAtFallback = existingCustomer?.createdAt || new Date();

  return {
    ...(payload._id || payload.id ? { _id: payload._id || payload.id } : {}),
    firstName,
    lastName,
    email: String(payload.email ?? existingCustomer?.email ?? '').trim().toLowerCase(),
    phone: String(payload.phone ?? existingCustomer?.phone ?? '').trim(),
    address: String(payload.address ?? existingCustomer?.address ?? '').trim(),
    status: String(payload.status ?? existingCustomer?.status ?? 'Active').trim() || 'Active',
    joinDate: String(payload.joinDate ?? existingCustomer?.joinDate ?? formatDateOnly(createdAtFallback)).trim(),
    dateOfBirth: String(payload.dateOfBirth ?? payload.dob ?? existingCustomer?.dateOfBirth ?? '').trim(),
    occupation: String(payload.occupation ?? existingCustomer?.occupation ?? '').trim(),
    income: Number(payload.income ?? existingCustomer?.income ?? 0),
    panNumber: String(payload.panNumber ?? existingCustomer?.panNumber ?? '').trim(),
    aadharNumber: String(payload.aadharNumber ?? existingCustomer?.aadharNumber ?? '').trim(),
    documents: Array.isArray(payload.documents)
      ? payload.documents
      : (Array.isArray(existingCustomer?.documents) ? existingCustomer.documents : []),
    activities: Array.isArray(payload.activities)
      ? payload.activities
      : (Array.isArray(existingCustomer?.activities) ? existingCustomer.activities : []),
    metadata: payload.metadata ?? existingCustomer?.metadata ?? {},
  };
}

exports.createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(buildCustomerPayload(req.body));
    res.status(201).json({ success: true, data: toPublicCustomer(customer) });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find().sort('-createdAt');
    const summaryMap = await buildLoanSummaryMap(customers);
    res.json({
      success: true,
      data: customers.map((customer) => toPublicCustomer(customer, summaryMap.get(String(customer._id)))),
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Not found' });
    }

    const loans = await Loan.find({ customer: customer._id }).sort('-createdAt');
    res.json({ success: true, data: toPublicCustomer(customer, null, loans) });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Not found' });
    }

    customer.set(buildCustomerPayload(req.body, customer));
    await customer.save();

    const loans = await Loan.find({ customer: customer._id }).sort('-createdAt');
    res.json({ success: true, data: toPublicCustomer(customer, null, loans) });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Not found' });
    }

    const activeLoans = await Loan.countDocuments({ customer: customer._id });
    if (activeLoans > 0) {
      return res.status(400).json({ message: 'Delete this customer\'s loans first so references stay consistent.' });
    }

    await customer.deleteOne();
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
