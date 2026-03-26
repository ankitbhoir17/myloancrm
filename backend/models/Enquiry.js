const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, required: true },
    status: { type: String, trim: true, default: 'New' },
    date: { type: String, default: '' },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
