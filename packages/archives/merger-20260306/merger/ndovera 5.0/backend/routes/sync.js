const express = require('express');
const router = express.Router();
const { getPendingEvents, markEventsSynced } = require('../controllers/syncController');

router.get('/pending', getPendingEvents);
router.post('/mark-synced', markEventsSynced);

module.exports = router;
