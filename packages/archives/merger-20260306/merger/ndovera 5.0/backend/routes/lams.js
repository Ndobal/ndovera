const express = require('express');
const router = express.Router();
const { getLedgerForUser, createLamsEntry } = require('../controllers/lamsController');

router.get('/ledger/:userId', getLedgerForUser);
router.post('/ledger', createLamsEntry);

module.exports = router;
