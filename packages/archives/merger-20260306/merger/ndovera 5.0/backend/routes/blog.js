const express = require('express');
const router = express.Router();

const {
  getPosts,
  getPost,
  createPost,
  updatePostStatus,
  getWorkflow,
  getDashboardStats,
  getPublishTargets,
} = require('../controllers/blogController');

router.get('/posts', getPosts);
router.get('/posts/:id', getPost);
router.post('/posts', createPost);
router.patch('/posts/:id/status', updatePostStatus);
router.get('/workflow', getWorkflow);
router.get('/dashboard-stats', getDashboardStats);
router.get('/publish-targets', getPublishTargets);

module.exports = router;
