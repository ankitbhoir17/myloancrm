const Lead = require('../models/Lead');
const { toOwnedPayload, withOwnedRecords } = require('../utils/ownership');

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function toPublicLead(lead) {
  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    createdBy: lead.createdBy ? String(lead.createdBy) : '',
    businessName: lead.businessName || '',
    businessEntity: lead.businessEntity || '',
    contactPerson: lead.contactPerson || '',
    primaryPhone: lead.primaryPhone || '',
    city: lead.city || '',
    sourcedBy: lead.sourcedBy || '',
    createdDate: lead.createdDate || formatDateOnly(lead.createdAt),
    status: lead.status || 'New',
    loanType: lead.loanType || 'Business Loans',
    metadata: lead.metadata || {},
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

function buildLeadPayload(req, payload = {}, existingLead = null) {
  const createdAtFallback = existingLead?.createdAt || new Date();

  return toOwnedPayload(req, {
    ...(payload._id || payload.id ? { _id: payload._id || payload.id } : {}),
    businessName: String(payload.businessName ?? existingLead?.businessName ?? '').trim(),
    businessEntity: String(payload.businessEntity ?? existingLead?.businessEntity ?? '').trim(),
    contactPerson: String(payload.contactPerson ?? existingLead?.contactPerson ?? '').trim(),
    primaryPhone: String(payload.primaryPhone ?? payload.phone ?? existingLead?.primaryPhone ?? '').trim(),
    city: String(payload.city ?? existingLead?.city ?? '').trim(),
    sourcedBy: String(payload.sourcedBy ?? existingLead?.sourcedBy ?? '').trim(),
    createdDate: String(payload.createdDate ?? existingLead?.createdDate ?? formatDateOnly(createdAtFallback)).trim(),
    status: String(payload.status ?? existingLead?.status ?? 'New').trim() || 'New',
    loanType: String(payload.loanType ?? existingLead?.loanType ?? 'Business Loans').trim() || 'Business Loans',
    metadata: payload.metadata ?? existingLead?.metadata ?? {},
  }, existingLead);
}

exports.createLead = async (req, res, next) => {
  try {
    const lead = await Lead.create(buildLeadPayload(req, req.body));
    res.status(201).json({ success: true, data: toPublicLead(lead) });
  } catch (error) {
    next(error);
  }
};

exports.bulkCreateLeads = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const payloads = items.map((item) => buildLeadPayload(req, item));
    const leads = await Lead.insertMany(payloads, { ordered: true });
    res.status(201).json({ success: true, data: leads.map(toPublicLead) });
  } catch (error) {
    next(error);
  }
};

exports.getLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find(withOwnedRecords(req)).sort('-createdAt');
    res.json({ success: true, data: leads.map(toPublicLead) });
  } catch (error) {
    next(error);
  }
};

exports.getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findOne(withOwnedRecords(req, { _id: req.params.id }));
    if (!lead) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.json({ success: true, data: toPublicLead(lead) });
  } catch (error) {
    next(error);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findOne(withOwnedRecords(req, { _id: req.params.id }));
    if (!lead) {
      return res.status(404).json({ message: 'Not found' });
    }

    lead.set(buildLeadPayload(req, req.body, lead));
    await lead.save();

    res.json({ success: true, data: toPublicLead(lead) });
  } catch (error) {
    next(error);
  }
};

exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Not found' });
    }

    await lead.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
