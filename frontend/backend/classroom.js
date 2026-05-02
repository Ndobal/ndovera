const express = require('express');
const router = express.Router();
const db = require('./db');

// Middleware to get classroom and check teacher access (placeholder)
router.use('/:classroomId', async (req, res, next) => {
  // TODO: Implement proper access control
  req.classroomId = req.params.classroomId;
  const classroom = await db.getClassById(req.classroomId);
  if (!classroom) {
    return res.status(404).json({ success: false, message: 'Classroom not found' });
  }
  req.classroom = classroom;
  next();
});

// GET /api/classrooms/:classroomId
router.get('/:classroomId', async (req, res) => {
  res.json({ success: true, class: req.classroom });
});

// GET /api/classrooms/:classroomId/stream
router.get('/:classroomId/stream', async (req, res) => {
  try {
    const posts = await db.getPostsForClass(req.classroomId);
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

// POST /api/classrooms/:classroomId/stream
router.post('/:classroomId/stream', async (req, res) => {
  const { content } = req.body;
  // TODO: get authorId from authenticated user
  const authorId = 'user-teacher-1'; // Placeholder

  if (!content) {
    return res.status(400).json({ success: false, message: 'Content is required' });
  }

  try {
    const newPost = {
      classId: req.classroomId,
      authorId,
      content,
    };
    const insertedPost = await db.createPost(newPost);
    res.status(201).json({ success: true, post: insertedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

// GET /api/classrooms/:classroomId/assignments
router.get('/:classroomId/assignments', async (req, res) => {
    try {
      const assignments = await db.getAssignmentsForClass(req.classroomId);
      res.json({ success: true, assignments });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error });
    }
  });

// POST /api/classrooms/:classroomId/assignments
router.post('/:classroomId/assignments', async (req, res) => {
    const { title, description, dueAt } = req.body;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required' });
    }

    try {
        const newAssignment = {
            classId: req.classroomId,
            title,
            description,
            dueAt
        };
        const insertedAssignment = await db.createAssignment(newAssignment);
        res.status(201).json({ success: true, assignment: insertedAssignment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});

// GET /api/classrooms/:classroomId/materials
router.get('/:classroomId/materials', async (req, res) => {
    try {
      const materials = await db.getMaterialsForClass(req.classroomId);
      res.json({ success: true, materials });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error });
    }
  });

// POST /api/classrooms/:classroomId/materials
router.post('/:classroomId/materials', async (req, res) => {
    const { title, url } = req.body;
    // TODO: get uploadedBy from authenticated user
    const uploadedBy = 'user-teacher-1'; // Placeholder

    if (!title || !url) {
        return res.status(400).json({ success: false, message: 'Title and URL are required' });
    }

    try {
        const newMaterial = {
            classId: req.classroomId,
            title,
            url,
            uploadedBy
        };
        const insertedMaterial = await db.addMaterial(newMaterial);
        res.status(201).json({ success: true, material: insertedMaterial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});

// POST /api/classrooms/:classroomId/materials/upload-multipart
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.post('/:classroomId/materials/upload-multipart', upload.single('file'), async (req, res) => {
    const { title } = req.body;
    const file = req.file;
    // TODO: get uploadedBy from authenticated user
    const uploadedBy = 'user-teacher-1'; // Placeholder

    if (!title || !file) {
        return res.status(400).json({ success: false, message: 'Title and file are required' });
    }

    try {
        const newMaterial = {
            classId: req.classroomId,
            title,
            url: file.path, // In a real app, this would be a URL from a cloud storage service
            uploadedBy
        };
        const insertedMaterial = await db.addMaterial(newMaterial);
        res.status(201).json({ success: true, material: insertedMaterial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});


// GET /api/classrooms/:classroomId/attendance
router.get('/:classroomId/attendance', async (req, res) => {
    try {
      const attendance = await db.getAttendanceForClass(req.classroomId);
      res.json({ success: true, attendance });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error });
    }
  });

// POST /api/classrooms/:classroomId/attendance
router.post('/:classroomId/attendance', async (req, res) => {
    const { studentId, date, status, notes } = req.body;
    // TODO: get recordedBy from authenticated user
    const recordedBy = 'user-teacher-1'; // Placeholder

    if (!studentId || !date || !status) {
        return res.status(400).json({ success: false, message: 'studentId, date, and status are required' });
    }

    try {
        const insertedRecord = await db.recordAttendance(req.classroomId, studentId, date, status, recordedBy, notes);
        res.status(201).json({ success: true, attendance: insertedRecord });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});

module.exports = router;
