const express = require('express');
const router = express.Router();
const { register, login, getMe, getSetupStatus } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/setup-status', getSetupStatus);
router.post('/register', register);
router.post('/login', login);

// Protected route
router.get('/me', protect, getMe);

module.exports = router;
