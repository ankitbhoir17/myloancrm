const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
} = require('../controllers/enquiriesController');

router.use(protect);

router.route('/').get(getEnquiries).post(createEnquiry);
router.route('/:id').get(getEnquiry).put(updateEnquiry).delete(deleteEnquiry);

module.exports = router;
