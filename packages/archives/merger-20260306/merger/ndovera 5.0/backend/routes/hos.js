const express = require('express');
const router = express.Router();
const {
	getApprovals,
	createApproval,
	updateApprovalStatus,
	getDashboardStats,
	getRecentStudents,
	getStaffActivity,
	getRecentPayments,
	getAttendanceChart,
	getFeesChart,
	getLamsChart,
	getLessons,
	getCASheets,
	getExams,
	getExamActivity,
	getExamCompilation,
	getResults,
	getResultsAudit,
	getPromotions,
	getPromotionsAudit,
	getSignatures,
	getSignatureAudit,
	getAuditLog,
	getCalendar,
	getCalendarEvents,
	getCalendarSessions,
	getHolidays,
	getHolidayEmergency,
	getHolidayResumption,
	getCaAnalytics,
	getExamAnalytics,
	getPromotionAnalytics,
} = require('../controllers/hosController');

router.get('/approvals', getApprovals);
router.post('/approvals', createApproval);
router.patch('/approvals/:id', updateApprovalStatus);

router.get('/dashboard-stats', getDashboardStats);
router.get('/recent-students', getRecentStudents);
router.get('/staff-activity', getStaffActivity);
router.get('/recent-payments', getRecentPayments);
router.get('/charts/attendance', getAttendanceChart);
router.get('/charts/fees', getFeesChart);
router.get('/charts/lams', getLamsChart);

router.get('/lessons', getLessons);
router.get('/ca-sheets', getCASheets);
router.get('/exams', getExams);
router.get('/exams/activity', getExamActivity);
router.get('/exams/compilation', getExamCompilation);
router.get('/results', getResults);
router.get('/results/audit', getResultsAudit);
router.get('/promotions', getPromotions);
router.get('/promotions/audit', getPromotionsAudit);
router.get('/signatures', getSignatures);
router.get('/signatures/audit', getSignatureAudit);
router.get('/audit', getAuditLog);
router.get('/calendar', getCalendar);
router.get('/calendar/events', getCalendarEvents);
router.get('/calendar/sessions', getCalendarSessions);
router.get('/holidays', getHolidays);
router.get('/holidays/emergency', getHolidayEmergency);
router.get('/holidays/resumption', getHolidayResumption);
router.get('/analytics/ca', getCaAnalytics);
router.get('/analytics/exams', getExamAnalytics);
router.get('/analytics/promotions', getPromotionAnalytics);

module.exports = router;
