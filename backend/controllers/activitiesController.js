const Activity = require('../models/Activity');

function toPublicActivity(activity) {
  if (!activity) {
    return null;
  }

  return {
    id: activity._id.toString(),
    _id: activity._id.toString(),
    type: activity.type || 'general',
    actor: activity.actor || activity.user?.username || activity.user?.name || 'system',
    message: activity.message || activity.note || '',
    meta: activity.meta || activity.metadata || {},
    read: Boolean(activity.read),
    date: activity.createdAt,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    userId: activity.user ? String(activity.user._id || activity.user) : '',
    customerId: activity.customer ? String(activity.customer._id || activity.customer) : '',
    loanId: activity.loan ? String(activity.loan._id || activity.loan) : '',
  };
}

function buildActivityPayload(req, payload = {}, existingActivity = null) {
  return {
    type: String(payload.type ?? existingActivity?.type ?? 'general').trim() || 'general',
    actor: String(payload.actor ?? existingActivity?.actor ?? req.user?.username ?? req.user?.name ?? 'system').trim() || 'system',
    message: String(payload.message ?? existingActivity?.message ?? payload.note ?? existingActivity?.note ?? '').trim(),
    note: String(payload.note ?? existingActivity?.note ?? payload.message ?? existingActivity?.message ?? '').trim(),
    read: payload.read != null ? Boolean(payload.read) : Boolean(existingActivity?.read),
    meta: payload.meta ?? existingActivity?.meta ?? payload.metadata ?? existingActivity?.metadata ?? {},
    metadata: payload.metadata ?? existingActivity?.metadata ?? payload.meta ?? existingActivity?.meta ?? {},
    user: payload.user ?? existingActivity?.user ?? req.user?.id ?? null,
    customer: payload.customer ?? existingActivity?.customer ?? null,
    loan: payload.loan ?? existingActivity?.loan ?? null,
  };
}

exports.createActivity = async (req, res, next) => {
  try {
    const activity = await Activity.create(buildActivityPayload(req, req.body));
    await activity.populate('user customer loan');
    res.status(201).json({ success: true, data: toPublicActivity(activity) });
  } catch (err) {
    next(err);
  }
};

exports.getActivities = async (req, res, next) => {
  try {
    const activities = await Activity.find().populate('user customer loan').sort('-createdAt');
    res.json({ success: true, data: activities.map(toPublicActivity) });
  } catch (err) {
    next(err);
  }
};

exports.getActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id).populate('user customer loan');
    if (!activity) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.json({ success: true, data: toPublicActivity(activity) });
  } catch (err) {
    next(err);
  }
};

exports.updateActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Not found' });
    }

    activity.set(buildActivityPayload(req, req.body, activity));
    await activity.save();
    await activity.populate('user customer loan');
    res.json({ success: true, data: toPublicActivity(activity) });
  } catch (err) {
    next(err);
  }
};

exports.markAllActivitiesRead = async (req, res, next) => {
  try {
    await Activity.updateMany({ read: false }, { $set: { read: true } });
    const activities = await Activity.find().populate('user customer loan').sort('-createdAt');
    res.json({ success: true, data: activities.map(toPublicActivity) });
  } catch (err) {
    next(err);
  }
};

exports.clearActivities = async (req, res, next) => {
  try {
    await Activity.deleteMany({});
    res.json({ success: true, data: [] });
  } catch (err) {
    next(err);
  }
};

exports.deleteActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
