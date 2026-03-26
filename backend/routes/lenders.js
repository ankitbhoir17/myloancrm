const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createLender,
  getLenders,
  getLender,
  updateLender,
  deleteLender,
} = require('../controllers/lendersController');
const { getLoginsByLender, createLoginForLender } = require('../controllers/loginsController');

router.route('/').get(protect, getLenders).post(protect, createLender);
router.route('/:id').get(protect, getLender).put(protect, updateLender).delete(protect, deleteLender);

router.get('/:id/logins', protect, getLoginsByLender);
router.post('/:id/logins', protect, createLoginForLender);

module.exports = router;
