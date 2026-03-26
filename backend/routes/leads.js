const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createLead,
  bulkCreateLeads,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
} = require('../controllers/leadsController');

router.use(protect);

router.post('/bulk', bulkCreateLeads);
router.route('/').get(getLeads).post(createLead);
router.route('/:id').get(getLead).put(updateLead).delete(deleteLead);

module.exports = router;
