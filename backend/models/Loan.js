const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    lenderName: { type: String, trim: true, default: '' },
    referenceName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true },
    type: { type: String, trim: true, default: 'Personal' },
    termMonths: { type: Number, default: 12 },
    interestRate: { type: Number, default: 0 },
    status: { type: String, trim: true, default: 'Leads' },
    date: { type: String, default: '' },
    appliedDate: { type: String, default: '' },
    approvedDate: { type: String, default: '' },
    disbursedDate: { type: String, default: '' },
    nextEmiDate: { type: String, default: '' },
    emi: { type: Number, default: 0 },
    disbursedAmount: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    emiHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loan', loanSchema);
