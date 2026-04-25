import express from 'express';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/run', auth, async (req, res) => {
  try {
    const { language, code, testCases } = req.body;
    
    // MOCK: This would typically make a request to a Docker container or Piston API
    // Return mock results for now
    
    const results = testCases.map(tc => {
      // Mock passing logic
      const passed = Math.random() > 0.2; // 80% chance of passing
      return {
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: passed ? tc.expectedOutput : 'Runtime Error or Wrong Output',
        passed
      };
    });

    const allPassed = results.every(r => r.passed);

    res.json({
      success: true,
      allPassed,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Code execution failed' });
  }
});

export default router;
