import express from 'express';
import prisma from '../db.js';
import { auth, instructorOnly } from '../middleware/auth.js';

const router = express.Router();

// Get all exams (Instructors see theirs, Students see all or available)
router.get('/', auth, async (req, res) => {
  try {
    const whereClause = req.user.role === 'INSTRUCTOR' ? { instructorId: req.user.id } : {};
    const exams = await prisma.exam.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { questions: true }
        }
      }
    });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// Create new exam
router.post('/', auth, instructorOnly, async (req, res) => {
  try {
    const { title, description, totalGrade, duration, startTime, endTime, questions } = req.body;
    
    // Validate question totals
    const sumScores = questions.reduce((acc, q) => acc + (q.score || 0), 0);
    if (sumScores > totalGrade) {
      return res.status(400).json({ error: 'Sum of question scores exceeds total exam grade' });
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        totalGrade,
        duration,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        instructorId: req.user.id,
        questions: {
          create: questions.map(q => ({
            type: q.type,
            score: q.score,
            content: q.content,
            language: q.language,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer ? JSON.stringify(q.correctAnswer) : null,
            hiddenTestCases: q.hiddenTestCases ? JSON.stringify(q.hiddenTestCases) : null,
            modelAnswer: q.modelAnswer
          }))
        }
      },
      include: { questions: true }
    });

    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create exam', details: error.message });
  }
});

// Get single exam details
router.get('/:id', auth, async (req, res) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: { questions: true }
    });

    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // If student, remove sensitive info like correct answers, test cases, and model answers (unless graded)
    if (req.user.role === 'STUDENT') {
      exam.questions = exam.questions.map(q => {
        const { correctAnswer, hiddenTestCases, modelAnswer, ...studentVisibleQ } = q;
        return studentVisibleQ;
      });
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exam details' });
  }
});

export default router;
