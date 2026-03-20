const express = require('express');
const router = express.Router();

const {
  getVideos,
  createVideo,
  updateVideoStatus,
  getAudit,
  getDashboardStats,
} = require('../controllers/videoGalleryController');

router.get('/videos', getVideos);
router.post('/videos', createVideo);
router.patch('/videos/:id/status', updateVideoStatus);
router.get('/audit', getAudit);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;
