const express = require('express');
const { getAdsConfig, updateAdsConfig, getAdFreeZones } = require('../controllers/settingsController');

const router = express.Router();

router.get('/ads', getAdsConfig);
router.post('/ads', updateAdsConfig);
router.put('/ads', updateAdsConfig);
router.get('/ad-free-zones', getAdFreeZones);

module.exports = router;
