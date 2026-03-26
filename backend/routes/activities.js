const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activitiesController');

router.route('/').get(protect, getActivities).post(protect, createActivity);
router.route('/:id').get(protect, getActivity).put(protect, updateActivity).delete(protect, deleteActivity);

module.exports = router;
