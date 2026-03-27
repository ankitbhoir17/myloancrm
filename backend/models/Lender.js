const mongoose = require('mongoose');

const lenderSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true },
    image: { type: String },
    status: { type: String, enum: ['New','Active','Inactive'], default: 'New' },
    metadata: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lender', lenderSchema);
