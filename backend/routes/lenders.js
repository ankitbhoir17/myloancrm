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

// Logins for a lender (read publicly for frontend demo; consider protecting in production)
router.get('/:id/logins', getLoginsByLender);
router.post('/:id/logins', protect, createLoginForLender);

module.exports = router;
