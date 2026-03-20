const express = require('express');
const router = express.Router();

const {
  getIdentities,
  createIdentity,
  getDashboardStats,
  getAudit,
} = require('../controllers/identityController');

router.get('/identities', getIdentities);
router.post('/identities', createIdentity);
router.get('/dashboard-stats', getDashboardStats);
router.get('/audit', getAudit);

module.exports = router;
