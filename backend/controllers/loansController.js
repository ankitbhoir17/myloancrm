const Customer = require('../models/Customer');
const Loan = require('../models/Loan');

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function buildCustomerName(customer) {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();
}

function resolveTermMonths(payload = {}, existingLoan = null) {
  if (payload.termMonths != null && payload.termMonths !== '') {
    return Number(payload.termMonths) || 12;
  }

  if (payload.tenure != null && payload.tenure !== '') {
    const tenureYears = Number(payload.tenure) || 0;
    return tenureYears ? Math.max(1, Math.round(tenureYears * 12)) : 12;
  }

  return Number(existingLoan?.termMonths || 12);
}

function resolveCustomerId(payload = {}, existingLoan = null) {
  return payload.customerId || payload.customer || existingLoan?.customer || null;
}

async function resolveCustomer(payload = {}, existingLoan = null) {
  const customerId = resolveCustomerId(payload, existingLoan);
  if (!customerId) {
    return null;
  }

  try {
    return await Customer.findById(customerId);
  } catch (error) {
    return null;
  }
}

function toPublicLoan(loan) {
  const customer = loan.customer && typeof loan.customer === 'object'
    ? loan.customer
    : null;
  const customerId = customer?._id || loan.customer;
  const customerName = buildCustomerName(customer) || loan.metadata?.customerName || '';
  const amount = Number(loan.amount || 0);
  const disbursedAmount = Number(loan.disbursedAmount || amount);
  const outstandingAmount = Number(loan.outstandingAmount ?? amount);

  return {
    id: loan._id.toString(),
    _id: loan._id.toString(),
    customerId: customerId ? customerId.toString() : '',
    customer: customerName,
    customerName,
    lenderName: loan.lenderName || '',
    referenceName: loan.referenceName || '',
    email: loan.email || customer?.email || '',
    phone: loan.phone || customer?.phone || '',
    amount,
    type: loan.type || 'Personal',
    status: loan.status || 'Leads',
    interest: Number(loan.interestRate || 0),
    interestRate: Number(loan.interestRate || 0),
    tenure: Number(((Number(loan.termMonths || 0) / 12) || 0).toFixed(2)),
    termMonths: Number(loan.termMonths || 0),
    tenureUnit: 'years',
    date: loan.date || loan.appliedDate || formatDateOnly(loan.createdAt),
    emi: Number(loan.emi || 0),
    disbursedAmount,
    outstandingAmount,
    appliedDate: loan.appliedDate || '',
    approvedDate: loan.approvedDate || '',
    disbursedDate: loan.disbursedDate || '',
    nextEmiDate: loan.nextEmiDate || '',
    documents: Array.isArray(loan.documents) ? loan.documents : [],
    emiHistory: Array.isArray(loan.emiHistory) ? loan.emiHistory : [],
  };
}

function buildLoanPayload(payload = {}, existingLoan = null, customer = null) {
  const amount = Number(payload.amount ?? existingLoan?.amount ?? 0);
  const termMonths = resolveTermMonths(payload, existingLoan);
  const date = String(payload.date ?? existingLoan?.date ?? payload.appliedDate ?? existingLoan?.appliedDate ?? formatDateOnly(new Date())).trim();

  return {
    ...(payload._id || payload.id ? { _id: payload._id || payload.id } : {}),
    customer: customer?._id || existingLoan?.customer,
    lenderName: String(payload.lenderName ?? existingLoan?.lenderName ?? '').trim(),
    referenceName: String(payload.referenceName ?? existingLoan?.referenceName ?? '').trim(),
    email: String(payload.email ?? existingLoan?.email ?? customer?.email ?? '').trim().toLowerCase(),
    phone: String(payload.phone ?? existingLoan?.phone ?? customer?.phone ?? '').trim(),
    amount,
    type: String(payload.type ?? existingLoan?.type ?? 'Personal').trim() || 'Personal',
    termMonths,
    interestRate: Number(payload.interestRate ?? payload.interest ?? existingLoan?.interestRate ?? 0),
    status: String(payload.status ?? existingLoan?.status ?? 'Leads').trim() || 'Leads',
    date,
    appliedDate: String(payload.appliedDate ?? existingLoan?.appliedDate ?? date).trim(),
    approvedDate: String(payload.approvedDate ?? existingLoan?.approvedDate ?? '').trim(),
    disbursedDate: String(payload.disbursedDate ?? existingLoan?.disbursedDate ?? '').trim(),
    nextEmiDate: String(payload.nextEmiDate ?? existingLoan?.nextEmiDate ?? '').trim(),
    emi: Number(payload.emi ?? existingLoan?.emi ?? 0),
    disbursedAmount: Number(payload.disbursedAmount ?? existingLoan?.disbursedAmount ?? amount),
    outstandingAmount: Number(payload.outstandingAmount ?? existingLoan?.outstandingAmount ?? amount),
    documents: Array.isArray(payload.documents)
      ? payload.documents
      : (Array.isArray(existingLoan?.documents) ? existingLoan.documents : []),
    emiHistory: Array.isArray(payload.emiHistory)
      ? payload.emiHistory
      : (Array.isArray(existingLoan?.emiHistory) ? existingLoan.emiHistory : []),
    metadata: {
      ...(existingLoan?.metadata || {}),
      ...(payload.metadata || {}),
      customerName: payload.customer || buildCustomerName(customer) || existingLoan?.metadata?.customerName || '',
    },
  };
}

exports.createLoan = async (req, res, next) => {
  try {
    const customer = await resolveCustomer(req.body);
    if (!customer) {
      return res.status(400).json({ message: 'A valid customer is required.' });
    }

    const loan = await Loan.create(buildLoanPayload(req.body, null, customer));
    await loan.populate('customer');

    res.status(201).json({ success: true, data: toPublicLoan(loan) });
  } catch (err) {
    next(err);
  }
};

exports.getLoans = async (req, res, next) => {
  try {
    const loans = await Loan.find().populate('customer').sort('-createdAt');
    res.json({ success: true, data: loans.map(toPublicLoan) });
  } catch (err) {
    next(err);
  }
};

exports.getLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('customer');
    if (!loan) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: toPublicLoan(loan) });
  } catch (err) {
    next(err);
  }
};

exports.updateLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('customer');
    if (!loan) return res.status(404).json({ message: 'Not found' });

    const customer = await resolveCustomer(req.body, loan);
    if (!customer) {
      return res.status(400).json({ message: 'A valid customer is required.' });
    }

    loan.set(buildLoanPayload(req.body, loan, customer));
    await loan.save();
    await loan.populate('customer');

    res.json({ success: true, data: toPublicLoan(loan) });
  } catch (err) {
    next(err);
  }
};

exports.deleteLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Not found' });
    await loan.deleteOne();
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
