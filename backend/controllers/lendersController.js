const Lender = require('../models/Lender');

exports.createLender = async (req, res, next) => {
  try {
    const lender = await Lender.create(req.body);
    res.status(201).json({ success: true, data: lender });
  } catch (err) { next(err); }
};

exports.getLenders = async (req, res, next) => {
  try {
    const lenders = await Lender.find().sort('-createdAt');
    res.json({ success: true, data: lenders });
  } catch (err) { next(err); }
};

exports.getLender = async (req, res, next) => {
  try {
    const lender = await Lender.findById(req.params.id);
    if (!lender) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: lender });
  } catch (err) { next(err); }
};

exports.updateLender = async (req, res, next) => {
  try {
    const lender = await Lender.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!lender) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: lender });
  } catch (err) { next(err); }
};

exports.deleteLender = async (req, res, next) => {
  try {
    const lender = await Lender.findByIdAndDelete(req.params.id);
    if (!lender) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
