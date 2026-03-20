const express = require('express');
const router = express.Router();
const {
	getSchools,
	getSchoolById,
	createSchool,
	updateSchool,
	deleteSchool,
} = require('../controllers/schoolsController');

// List schools (optionally filter by owner_id or hos_id)
router.get('/', getSchools);

// Get single school
router.get('/:id', getSchoolById);

// Create school
router.post('/create', createSchool);

// Update school
router.put('/:id', updateSchool);

// Delete school
router.delete('/:id', deleteSchool);

module.exports = router;
