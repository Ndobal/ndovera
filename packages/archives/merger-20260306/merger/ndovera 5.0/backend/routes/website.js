const express = require('express');
const router = express.Router();
const { getPagesForSchool, upsertPage } = require('../controllers/websiteController');

router.get('/pages/:schoolId', getPagesForSchool);
router.post('/pages', upsertPage);

module.exports = router;
