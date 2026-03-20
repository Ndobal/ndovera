const express = require('express');
const router = express.Router();

const {
  getEvents,
  createEvent,
  updateEventStatus,
  getAudit,
  getDashboardStats,
} = require('../controllers/liveEventsController');

router.get('/events', getEvents);
router.post('/events', createEvent);
router.patch('/events/:id/status', updateEventStatus);
router.get('/audit', getAudit);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
