const express = require('express');
const {
  listExams,
  createExam,
  addQuestion,
  getExamQuestions,
  updateExamStatus,
  submitAttempt,
} = require('../controllers/onlineExamController');

const router = express.Router();

router.get('/exams', listExams);
router.post('/exams', createExam);
router.post('/exams/questions', addQuestion);
router.get('/exams/:exam_id/questions', getExamQuestions);
router.patch('/exams/:exam_id/status', updateExamStatus);
router.post('/attempts', submitAttempt);

module.exports = router;
