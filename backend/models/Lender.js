const mongoose = require('mongoose');

const lenderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String },
    status: { type: String, enum: ['New','Active','Inactive'], default: 'New' },
    metadata: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lender', lenderSchema);
