const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createActivity,
  getActivities,
  getActivity,
  updateActivity,
  markAllActivitiesRead,
  clearActivities,
  deleteActivity,
} = require('../controllers/activitiesController');

router.post('/', protect, createActivity);
router.patch('/mark-all-read', protect, authorize('superuser'), markAllActivitiesRead);
router.route('/')
  .get(protect, authorize('superuser'), getActivities)
  .delete(protect, authorize('superuser'), clearActivities);
router.route('/:id')
  .get(protect, authorize('superuser'), getActivity)
  .put(protect, authorize('superuser'), updateActivity)
  .delete(protect, authorize('superuser'), deleteActivity);

module.exports = router;
