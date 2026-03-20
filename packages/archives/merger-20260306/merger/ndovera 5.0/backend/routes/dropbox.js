const express = require('express');
const router = express.Router();

const {
  getItems,
  getItem,
  createItem,
  updateLockStatus,
  getAudit,
  getDashboardStats,
} = require('../controllers/dropboxController');

router.get('/items', getItems);
router.get('/items/:id', getItem);
router.post('/items', createItem);
router.patch('/items/:id/lock', updateLockStatus);
router.get('/audit', getAudit);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
