const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    actor: { type: String, trim: true, default: 'system' },
    message: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    read: { type: Boolean, default: false },
    meta: { type: Object, default: {} },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', activitySchema);
