const express = require('express');
const router = express.Router();
const examController = require('./exam.controller');
const { authMiddleware, instructorOnly } = require('../../middleware/auth.middleware');

router.post('/', authMiddleware, instructorOnly, examController.createExam);
router.get('/', authMiddleware, instructorOnly, examController.getExams);
router.get('/access/:code', authMiddleware, examController.getExamByCode);
router.get('/:id', authMiddleware, examController.getExamById);
router.put('/:id', authMiddleware, instructorOnly, examController.updateExam);
router.patch('/:id/toggle-results', authMiddleware, instructorOnly, examController.toggleExamResults);
router.delete('/:id', authMiddleware, instructorOnly, examController.deleteExam);

// 🚩 CATCH-ALL FOR ROUTER (Safety check)
router.use((req, res) => {
  console.error(`🚩 ROUTE NOT FOUND: [${req.method}] ${req.originalUrl}`);
  res.status(404).json({ error: `The endpoint [${req.method}] ${req.originalUrl} does not exist in the Exam Router.` });
});

module.exports = router;


