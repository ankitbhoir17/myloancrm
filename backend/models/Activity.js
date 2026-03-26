const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    note: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', activitySchema);
