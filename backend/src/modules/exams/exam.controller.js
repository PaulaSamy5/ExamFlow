const { run, query, get } = require('../../config/db');
const crypto = require('crypto');

const generateAccessCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const formatSqlDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    
    // Adjust for local timezone offset before converting to SQL format
    // This ensures what the user sees in the input is exactly what is stored
    const pad = (n) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    
    return `${year}${month}${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateStr;
  }
};

const createExam = async (req, res) => {
  const { title, description, totalGrade, duration, startTime, endTime, questions, showResults, requireAIGradeApproval, examType, examMeta } = req.body;
  const instructorId = parseInt(req.user.id);

  // ─── VAL-002: Server-side exam field validation ───
  if (!title || !title.trim()) return res.status(400).json({ error: 'Exam title is required.' });
  if (title.trim().length > 500) return res.status(400).json({ error: 'Title must be 500 characters or fewer.' });
  const parsedGrade = parseFloat(totalGrade);
  if (isNaN(parsedGrade) || parsedGrade <= 0) return res.status(400).json({ error: 'Total grade must be a positive number.' });
  const parsedDuration = parseInt(duration);
  if (isNaN(parsedDuration) || parsedDuration <= 0) return res.status(400).json({ error: 'Duration must be a positive number of minutes.' });
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'At least one question is required.' });
  }
  const finalExamTypeCheck = examType === 'PRINTABLE_ONLY' ? 'PRINTABLE_ONLY' : 'ONLINE';
  if (finalExamTypeCheck === 'ONLINE') {
    if (!startTime) return res.status(400).json({ error: 'Start time is required for online exams.' });
    if (!endTime) return res.status(400).json({ error: 'End time is required for online exams.' });
    if (new Date(startTime) >= new Date(endTime)) return res.status(400).json({ error: 'End time must be after start time.' });
  }

  const accessCode = generateAccessCode();

  try {
    const finalVisibility = (showResults === undefined || showResults === null) ? 1 : parseInt(showResults);
    const finalApproval = parseInt(requireAIGradeApproval) || 0;

    // Validation: Mutual Exclusivity
    if (finalVisibility === 1 && finalApproval === 1) {
       return res.status(400).json({ error: "Invalid Configuration: Immediate Release cannot be combined with Manual AI Approval." });
    }

    const cleanGrade = parseFloat(totalGrade) || 0;
    const cleanDuration = parseInt(duration) || 0;
    const finalExamType = examType === 'PRINTABLE_ONLY' ? 'PRINTABLE_ONLY' : 'ONLINE';
    // Printable exams have no schedule — store NULL to avoid NOT NULL constraint violation
    const sqlStartTime = finalExamType === 'PRINTABLE_ONLY' ? null : formatSqlDate(startTime);
    const sqlEndTime   = finalExamType === 'PRINTABLE_ONLY' ? null : formatSqlDate(endTime);
    const finalExamMeta = examMeta ? JSON.stringify(examMeta) : null;

    const insertResult = await query(
      `INSERT INTO Exams (title, description, accessCode, totalGrade, duration, startTime, endTime, instructorId, showResults, requireAIGradeApproval, examType, examMeta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [title, description || null, accessCode, cleanGrade, cleanDuration, sqlStartTime, sqlEndTime, instructorId, finalVisibility, finalApproval, finalExamType, finalExamMeta]
    );

    const examId = insertResult[0].id;
    // ... rest of the logic

    for (const q of questions) {
      const cleanPoints = parseFloat(q.points) || 0;
      await run(
        'INSERT INTO Questions (examId, type, text, points, options, correctAnswer, isMultiple) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [examId, q.type, q.text, cleanPoints, q.options ? JSON.stringify(q.options) : null, q.correctAnswer || null, q.isMultiple ? 1 : 0]
      );
    }

    const exam = await get('SELECT * FROM Exams WHERE id = ?', [examId]);
    if (exam && exam.examMeta) {
      try {
        exam.examMeta = JSON.parse(exam.examMeta);
      } catch (e) {
        console.error('Error parsing examMeta in createExam response:', e);
      }
    }
    res.status(201).json(exam);
  } catch (err) {
    console.error('❌ Database Error during Exam Creation:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

const getExams = async (req, res) => {
  const instructorId = parseInt(req.user.id);
  try {
    const examsResult = await query(`
      SELECT e.*, u.name as instructorName,
      (SELECT COUNT(*) FROM Questions WHERE examId = e.id) as questionCount
      FROM Exams e
      JOIN Users u ON e.instructorId = u.id
      WHERE e.instructorId = ?
      ORDER BY e.createdAt DESC
    `, [instructorId]);
    
    const exams = examsResult.map(e => {
      let parsedMeta = null;
      if (e.examMeta) {
        try {
          parsedMeta = JSON.parse(e.examMeta);
        } catch (err) {
          console.error('Error parsing examMeta in getExams:', err);
        }
      }
      return {
        ...e,
        examMeta: parsedMeta,
        instructor: { name: e.instructorName },
        _count: { questions: parseInt(e.questionCount, 10) || 0 }
      };
    });

    res.json(exams);
  } catch (err) {
    console.error('❌ Database Sync Failure (getExams):', err.message);
    res.status(500).json({ error: 'Failed to synchronize assessment matrix: ' + err.message });
  }
};

const getExamByCode = async (req, res) => {
  const { code } = req.params;
  try {
    const exam = await get('SELECT id, title FROM Exams WHERE accessCode = ?', [code.toUpperCase()]);
    if (!exam) return res.status(404).json({ error: 'Invalid access code' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getExamById = async (req, res) => {
  const { id } = req.params;
  try {
    const exam = await get(`
        SELECT e.*, u.name as instructorName
        FROM Exams e
        JOIN Users u ON e.instructorId = u.id
        WHERE e.id = ?
      `, [id]);

    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    if (exam.examMeta) {
      try {
        exam.examMeta = JSON.parse(exam.examMeta);
      } catch (e) {
        console.error('Error parsing examMeta in getExamById:', e);
      }
    }

    const questionsResult = await query('SELECT * FROM Questions WHERE examId = ?', [id]);
    exam.instructor = { name: exam.instructorName };
    exam.questions = questionsResult.map(q => {
      let parsedOptions = q.options ? JSON.parse(q.options) : null;
      if (req.user.role !== 'INSTRUCTOR' && q.type === 'CODING' && parsedOptions) {
          parsedOptions.testCases = undefined;
      }
      return {
        ...q,
        options: parsedOptions,
        ...(req.user.role !== 'INSTRUCTOR' && { correctAnswer: undefined })
      };
    });

    // Include submission count so the frontend can lock question editing
    const subCount = await get(
      `SELECT COUNT(*) as cnt FROM Submissions WHERE examId = ? AND status = 'SUBMITTED'`,
      [id]
    );
    exam.submissionCount = (subCount && subCount.cnt) ? parseInt(subCount.cnt, 10) : 0;

    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const deleteExam = async (req, res) => {
  const { id } = req.params;
  const instructorId = req.user.id;
  try {
    const exam = await get('SELECT * FROM Exams WHERE id = ? AND instructorId = ?', [id, instructorId]);
    if (!exam) return res.status(404).json({ error: 'Exam not found or unauthorized' });
    
    // Clean up all related data to avoid foreign key conflicts
    await run('DELETE FROM Answers WHERE questionId IN (SELECT id FROM Questions WHERE examId = ?)', [id]);
    await run('DELETE FROM Questions WHERE examId = ?', [id]);
    await run('DELETE FROM Submissions WHERE examId = ?', [id]);
    await run('DELETE FROM Exams WHERE id = ?', [id]);
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateExam = async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, totalGrade, duration, startTime, endTime, questions, showResults, requireAIGradeApproval, examType, examMeta } = req.body;
  const instructorId = parseInt(req.user.id);
  
  // HIGH-003: Validate fields when present (same rules as createExam)
  if (title !== undefined) {
    if (!title || !title.trim()) return res.status(400).json({ error: 'Exam title is required.' });
    if (title.trim().length > 500) return res.status(400).json({ error: 'Title must be 500 characters or fewer.' });
  }
  if (totalGrade !== undefined) {
    const parsedGrade = parseFloat(totalGrade);
    if (isNaN(parsedGrade) || parsedGrade <= 0) return res.status(400).json({ error: 'Total grade must be a positive number.' });
  }
  if (duration !== undefined) {
    const parsedDuration = parseInt(duration);
    if (isNaN(parsedDuration) || parsedDuration <= 0) return res.status(400).json({ error: 'Duration must be a positive number of minutes.' });
  }
  if (questions !== undefined && (!Array.isArray(questions) || questions.length === 0)) {
    return res.status(400).json({ error: 'At least one question is required.' });
  }
  const finalExamTypeUpdateCheck = examType === 'PRINTABLE_ONLY' ? 'PRINTABLE_ONLY' : 'ONLINE';
  if (finalExamTypeUpdateCheck === 'ONLINE') {
    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }
  }

  try {
    const dbExam = await get('SELECT id, instructorId FROM Exams WHERE id = ?', [id]);

    if (!dbExam) {
       return res.status(404).json({ error: `Assessment Matrix [ID:${id}] not found.` });
    }

    if (parseInt(dbExam.instructorId) !== instructorId) {
       return res.status(403).json({ error: 'Permission Denied.' });
    }

    const finalVisibility = (showResults === undefined || showResults === null) ? 1 : parseInt(showResults);
    const finalApproval = parseInt(requireAIGradeApproval) || 0;

    // Validation: Mutual Exclusivity
    if (finalVisibility === 1 && finalApproval === 1) {
       return res.status(400).json({ error: "Invalid Configuration: Immediate Release cannot be combined with Manual AI Approval." });
    }

    const cleanGrade = parseFloat(totalGrade) || 0;
    const cleanDuration = parseInt(duration) || 0;
    const finalExamType = examType === 'PRINTABLE_ONLY' ? 'PRINTABLE_ONLY' : 'ONLINE';
    // Printable exams have no schedule — store NULL to avoid NOT NULL constraint violation
    const sqlStartTime = finalExamType === 'PRINTABLE_ONLY' ? null : formatSqlDate(startTime);
    const sqlEndTime   = finalExamType === 'PRINTABLE_ONLY' ? null : formatSqlDate(endTime);
    const finalExamMeta = examMeta ? JSON.stringify(examMeta) : null;

    await run(
      `UPDATE Exams SET title=?, description=?, totalGrade=?, duration=?, startTime=?, endTime=?, showResults=?, requireAIGradeApproval=?, examType=?, examMeta=? WHERE id=?`,
      [title, description || null, cleanGrade, cleanDuration, sqlStartTime, sqlEndTime, finalVisibility, finalApproval, finalExamType, finalExamMeta, id]
    );

    // Sync Questions — only if questions array was provided
    if (questions && questions.length > 0) {
      // Guard: block question changes if students have already submitted to preserve their answers
      const submissionCount = await get('SELECT COUNT(*) as cnt FROM Submissions WHERE examId = ? AND status = ?', [id, 'SUBMITTED']);
      if (submissionCount && submissionCount.cnt > 0) {
        return res.status(409).json({
          error: `Cannot modify questions: ${submissionCount.cnt} student submission(s) already exist for this exam. Only exam metadata (title, description, dates, grade, settings) was updated.`,
          metadataUpdated: true,
          submissionCount: submissionCount.cnt
        });
      }

      // No submissions — safe to resync questions
      await run('DELETE FROM Answers WHERE questionId IN (SELECT id FROM Questions WHERE examId = ?)', [id]);
      await run('DELETE FROM Questions WHERE examId = ?', [id]);
      for (const q of questions) {
        const cleanPoints = parseFloat(q.points) || 0;
        await run(
          'INSERT INTO Questions (examId, type, text, points, options, correctAnswer, isMultiple) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, q.type, q.text, cleanPoints, q.options ? JSON.stringify(q.options) : null, q.correctAnswer || null, q.isMultiple ? 1 : 0]
        );
      }
    }

    res.json({ message: 'Exam updated successfully' });
  } catch (err) {
    console.error('❌ Update Failure Logic:', err.message);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

const toggleExamResults = async (req, res) => {
  const { id } = req.params;
  const instructorId = parseInt(req.user.id);
  
  try {
    // Diagnostic log to help identify 404 causes
    const checkExams = await query('SELECT id, instructorId FROM Exams WHERE id = ?', [id]);
    if (checkExams.length === 0) {
       console.error(`🚩 DB ERROR: Exam ID ${id} not found in database.`);
    } else if (parseInt(checkExams[0].instructorId) !== instructorId) {
       console.error(`🚩 AUTH ERROR: Exam ${id} belongs to instructor ${checkExams[0].instructorId}, but current user is ${instructorId}`);
    }

    const exam = await get('SELECT showResults FROM Exams WHERE id = ? AND instructorId = ?', [id, instructorId]);
    if (!exam) return res.status(404).json({ error: 'Assessment not found or access denied' });
    
    // Toggle logic: If hidden (0) -> make instant (1). Otherwise -> make manual (0)
    const newState = (exam.showResults === 0) ? 1 : 0;
    await run('UPDATE Exams SET showResults = ? WHERE id = ?', [newState, id]);
    res.json({ message: 'Success', showResults: newState });
  } catch (err) {
    console.error('❌ Toggle Failure:', err.message);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

module.exports = { createExam, getExams, getExamById, deleteExam, getExamByCode, toggleExamResults, updateExam };
