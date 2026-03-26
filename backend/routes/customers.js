const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customersController');

router.route('/').get(protect, getCustomers).post(protect, createCustomer);
router.route('/:id').get(protect, getCustomer).put(protect, updateCustomer).delete(protect, deleteCustomer);

module.exports = router;
