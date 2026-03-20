const express = require('express');
const router = express.Router();

const {
  getBatches,
  createBatch,
  updateBatchStatus,
  getAudit,
  getDashboardStats,
} = require('../controllers/nmeController');

router.get('/batches', getBatches);
router.post('/batches', createBatch);
router.patch('/batches/:id/status', updateBatchStatus);
router.get('/audit', getAudit);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
