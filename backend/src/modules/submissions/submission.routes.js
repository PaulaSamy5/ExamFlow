const express = require('express');
const router = express.Router();
const submissionController = require('./submission.controller');
const { authMiddleware, studentOnly, instructorOnly } = require('../../middleware/auth.middleware');

// Student Routes
router.post('/:examId/start', authMiddleware, studentOnly, submissionController.startSubmission);
router.patch('/:id/save', authMiddleware, studentOnly, submissionController.saveDraft);
router.post('/:id/submit', authMiddleware, studentOnly, submissionController.submitExam);
router.get('/stats', authMiddleware, studentOnly, submissionController.getStudentStats);
router.get('/my', authMiddleware, studentOnly, submissionController.getMySubmissions);

// Instructor Routes
router.get('/exam/:examId', authMiddleware, instructorOnly, submissionController.getExamSubmissions);
router.patch('/:submissionId/answers/:answerId', authMiddleware, instructorOnly, submissionController.updateAnswerScore);
router.post('/:submissionId/answers/:answerId/approve-ai', authMiddleware, instructorOnly, submissionController.approveAIGrade);

// Common / Review Routes
router.get('/:id', authMiddleware, submissionController.getSubmission);

module.exports = router;
