const express = require('express');
const router = express.Router();

const {
  getEvents,
  publishEvent,
  getDashboardStats,
} = require('../controllers/eventBusController');

router.get('/events', getEvents);
router.post('/events', publishEvent);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
