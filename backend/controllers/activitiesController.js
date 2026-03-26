const Activity = require('../models/Activity');

exports.createActivity = async (req, res, next) => {
  try {
    const activity = await Activity.create(req.body);
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
};

exports.getActivities = async (req, res, next) => {
  try {
    const activities = await Activity.find().populate('user customer loan').sort('-createdAt');
    res.json({ success: true, data: activities });
  } catch (err) {
    next(err);
  }
};

exports.getActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id).populate('user customer loan');
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
};

exports.updateActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
};

exports.deleteActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
