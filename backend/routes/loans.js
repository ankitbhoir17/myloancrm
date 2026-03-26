const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createLoan,
  getLoans,
  getLoan,
  updateLoan,
  deleteLoan,
} = require('../controllers/loansController');

router.route('/').get(protect, getLoans).post(protect, createLoan);
router.route('/:id').get(protect, getLoan).put(protect, updateLoan).delete(protect, deleteLoan);

module.exports = router;
