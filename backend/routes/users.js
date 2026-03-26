const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} = require('../controllers/usersController');

router.use(protect, authorize('superuser'));

router.route('/').get(getUsers).post(createUser);
router.route('/:id').put(updateUser).delete(deleteUser);
router.patch('/:id/password', resetUserPassword);

module.exports = router;
