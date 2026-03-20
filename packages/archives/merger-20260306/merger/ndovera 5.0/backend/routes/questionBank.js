const express = require('express');
const router = express.Router();

const {
  getQuestions,
  createQuestion,
  getBlueprints,
  createBlueprint,
  getPapers,
  createPaper,
  getDashboardStats,
  getAudit,
} = require('../controllers/questionBankController');

router.get('/questions', getQuestions);
router.post('/questions', createQuestion);
router.get('/blueprints', getBlueprints);
router.post('/blueprints', createBlueprint);
router.get('/papers', getPapers);
router.post('/papers', createPaper);
router.get('/dashboard-stats', getDashboardStats);
router.get('/audit', getAudit);

module.exports = router;
