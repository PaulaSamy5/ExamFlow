import express from 'express';
import prisma from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Start an exam session
router.post('/start', auth, async (req, res) => {
  try {
    const { examId } = req.body;
    
    // Check if already active
    const existing = await prisma.submission.findFirst({
      where: { examId, studentId: req.user.id, status: 'IN_PROGRESS' }
    });

    if (existing) {
      return res.json(existing);
    }

    const submission = await prisma.submission.create({
      data: {
        examId,
        studentId: req.user.id,
      }
    });

    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start exam', details: error.message });
  }
});

// Save auto-save answers
router.post('/:id/answers', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // Array of { questionId, content }

    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.studentId !== req.user.id || submission.status !== 'IN_PROGRESS') {
      return res.status(403).json({ error: 'Invalid or closed submission' });
    }

    // Upsert answers
    for (const ans of answers) {
      const existingAns = await prisma.answer.findFirst({
        where: { submissionId: id, questionId: ans.questionId }
      });

      if (existingAns) {
        await prisma.answer.update({
          where: { id: existingAns.id },
          data: { content: ans.content }
        });
      } else {
        await prisma.answer.create({
          data: {
            submissionId: id,
            questionId: ans.questionId,
            content: ans.content
          }
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save answers' });
  }
});

// Submit and auto-grade
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { answers: true, exam: { include: { questions: true } } }
    });

    if (!submission || submission.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Invalid submission' });
    }

    let totalScore = 0;

    // Simple auto-grading logic
    for (const answer of submission.answers) {
      const question = submission.exam.questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      let scoreObtained = 0;
      let isCorrect = false;

      // Basic matching for now
      if (['MCQ', 'TRUE_FALSE', 'MATCHING'].includes(question.type)) {
         if (question.correctAnswer && answer.content === JSON.parse(question.correctAnswer)) {
           scoreObtained = question.score;
           isCorrect = true;
         }
      } else if (question.type === 'FILL_BLANKS') {
         if (question.correctAnswer && answer.content?.toLowerCase() === JSON.parse(question.correctAnswer).toLowerCase()) {
           scoreObtained = question.score;
           isCorrect = true;
         }
      }
      
      // Update answer with score
      await prisma.answer.update({
        where: { id: answer.id },
        data: { scoreObtained, isCorrect }
      });
      
      totalScore += scoreObtained;
    }

    // Mark submitted
    const finalSubmission = await prisma.submission.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        endTime: new Date(),
        score: totalScore
      }
    });

    res.json(finalSubmission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

export default router;
