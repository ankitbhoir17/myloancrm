const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: 'Active' },
    joinDate: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    occupation: { type: String, trim: true, default: '' },
    income: { type: Number, default: 0 },
    panNumber: { type: String, trim: true, default: '' },
    aadharNumber: { type: String, trim: true, default: '' },
    documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    activities: { type: [mongoose.Schema.Types.Mixed], default: [] },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
