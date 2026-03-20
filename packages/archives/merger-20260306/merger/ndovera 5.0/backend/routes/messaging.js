const express = require('express');
const router = express.Router();

const {
  getThreads,
  createThread,
  getMessages,
  sendMessage,
  getAudit,
  getDashboardStats,
} = require('../controllers/messagingController');

router.get('/threads', getThreads);
router.post('/threads', createThread);
router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.get('/audit', getAudit);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
