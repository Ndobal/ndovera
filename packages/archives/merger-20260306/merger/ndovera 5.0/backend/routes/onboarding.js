const express = require('express');
const {
  createStaffPreprofile,
  completeStaffProfile,
  verifyStaffCashout,
  createStudentPreprofile,
  migrateStudent,
  listStaffProfiles,
  listStudents,
} = require('../controllers/onboardingController');

const router = express.Router();

router.get('/staff', listStaffProfiles);
router.post('/staff/preprofile', createStaffPreprofile);
router.put('/staff/:id/complete', completeStaffProfile);
router.put('/staff/:id/cashout-verify', verifyStaffCashout);

router.get('/students', listStudents);
router.post('/students/preprofile', createStudentPreprofile);
router.put('/students/:id/migrate', migrateStudent);

module.exports = router;
