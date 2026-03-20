const express = require('express');
const router = express.Router();

const {
  getUploads,
  createUpload,
  updateUploadStatus,
  getTags,
  getAudit,
  getDashboardStats,
} = require('../controllers/resultsBulkController');

router.get('/uploads', getUploads);
router.post('/uploads', createUpload);
router.patch('/uploads/:id/status', updateUploadStatus);
router.get('/tags', getTags);
router.get('/audit', getAudit);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
