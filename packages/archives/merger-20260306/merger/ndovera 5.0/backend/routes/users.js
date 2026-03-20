const express = require('express');
const router = express.Router();
const {
	loginUser,
	getUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser,
} = require('../controllers/usersController');

// Login (public)
router.post('/login', loginUser);

// List users (optionally filter by school_id)
router.get('/', getUsers);

// Get single user by id
router.get('/:id', getUserById);

// Create user
router.post('/create', createUser);

// Update user
router.put('/:id', updateUser);

// Delete user
router.delete('/:id', deleteUser);

module.exports = router;
