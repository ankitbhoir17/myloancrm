const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');

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

async function resolveCustomer(customerId) {
  if (!customerId) {
    return null;
  }

  try {
    return await Customer.findById(customerId);
  } catch (error) {
    return null;
  }
}

function toPublicEnquiry(enquiry) {
  const customer = enquiry.customer && typeof enquiry.customer === 'object'
    ? enquiry.customer
    : null;
  const customerId = customer?._id || enquiry.customer;
  const customerName = buildCustomerName(customer) || enquiry.customerName || '';

  return {
    id: enquiry._id.toString(),
    _id: enquiry._id.toString(),
    customerId: customerId ? customerId.toString() : '',
    customerName,
    email: enquiry.email || customer?.email || '',
    phone: enquiry.phone || customer?.phone || '',
    message: enquiry.message || '',
    status: enquiry.status || 'New',
    date: enquiry.date || formatDateOnly(enquiry.createdAt),
    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
  };
}

async function buildEnquiryPayload(payload = {}, existingEnquiry = null) {
  const customer = await resolveCustomer(payload.customerId || payload.customer || existingEnquiry?.customer);
  const dateFallback = existingEnquiry?.createdAt || new Date();
  const requestedCustomerName = String(payload.customerName ?? '').trim();
  const resolvedCustomerName = requestedCustomerName || buildCustomerName(customer) || existingEnquiry?.customerName || '';

  return {
    ...(payload._id || payload.id ? { _id: payload._id || payload.id } : {}),
    customer: customer?._id || null,
    customerName: resolvedCustomerName,
    email: String(payload.email ?? existingEnquiry?.email ?? customer?.email ?? '').trim().toLowerCase(),
    phone: String(payload.phone ?? existingEnquiry?.phone ?? customer?.phone ?? '').trim(),
    message: String(payload.message ?? existingEnquiry?.message ?? '').trim(),
    status: String(payload.status ?? existingEnquiry?.status ?? 'New').trim() || 'New',
    date: String(payload.date ?? existingEnquiry?.date ?? formatDateOnly(dateFallback)).trim(),
    metadata: payload.metadata ?? existingEnquiry?.metadata ?? {},
  };
}

exports.createEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.create(await buildEnquiryPayload(req.body));
    await enquiry.populate('customer');
    res.status(201).json({ success: true, data: toPublicEnquiry(enquiry) });
  } catch (error) {
    next(error);
  }
};

exports.getEnquiries = async (req, res, next) => {
  try {
    const enquiries = await Enquiry.find().populate('customer').sort('-createdAt');
    res.json({ success: true, data: enquiries.map(toPublicEnquiry) });
  } catch (error) {
    next(error);
  }
};

exports.getEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).populate('customer');
    if (!enquiry) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.json({ success: true, data: toPublicEnquiry(enquiry) });
  } catch (error) {
    next(error);
  }
};

exports.updateEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).populate('customer');
    if (!enquiry) {
      return res.status(404).json({ message: 'Not found' });
    }

    enquiry.set(await buildEnquiryPayload(req.body, enquiry));
    await enquiry.save();
    await enquiry.populate('customer');

    res.json({ success: true, data: toPublicEnquiry(enquiry) });
  } catch (error) {
    next(error);
  }
};

exports.deleteEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Not found' });
    }

    await enquiry.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
