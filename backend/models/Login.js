const mongoose = require('mongoose');

const loginSchema = new mongoose.Schema(
  {
    lender: { type: mongoose.Schema.Types.ObjectId, ref: 'Lender', required: true },
    leadName: { type: String, required: true },
    surrogate: { type: String },
    loginDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Done', 'Pending', 'Failed', 'In Review'], default: 'Done' },
    remarks: { type: String },
    product: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Login', loginSchema);
