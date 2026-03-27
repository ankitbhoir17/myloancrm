const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    businessName: { type: String, trim: true, required: true },
    businessEntity: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    primaryPhone: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    sourcedBy: { type: String, trim: true, default: '' },
    createdDate: { type: String, default: '' },
    status: { type: String, trim: true, default: 'New' },
    loanType: { type: String, trim: true, default: 'Business Loans' },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
