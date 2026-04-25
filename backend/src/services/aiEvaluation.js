const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT) || 30000; // 30 seconds

/**
 * Evaluates a UML diagram using the Python AI image processing service.
 * @param {string} studentImage - Base64 encoded image of the student's diagram.
 * @param {string} modelImage - Base64 encoded image of the model diagram.
 * @param {string} diagramType - Type of diagram (usecase, class, erd, activity, sequence).
 * @returns {Promise<{score: number, feedback: string, details: object, failed: boolean}>}
 */
async function evaluateDiagramWithAI(studentImage, modelImage, diagramType = 'usecase') {
  // Validate inputs
  if (!studentImage || !modelImage) {
    return {
      score: 0,
      feedback: "AI evaluation skipped: Missing diagram images.",
      failed: true
    };
  }

  try {
    // Check health first (fast fail if service is down)
    try {
      await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 });
    } catch (healthErr) {
      console.warn("[AI Service] Health check failed — service may be offline:", healthErr.message);
      return {
        score: 0,
        feedback: "AI service is currently unavailable. Falling back to graph-based evaluation.",
        failed: true
      };
    }

    // Call the AI evaluation endpoint
    const response = await axios.post(`${AI_SERVICE_URL}/evaluate-diagram`, {
      studentImage,
      modelImage,
      diagramType: diagramType || 'usecase'
    }, {
      timeout: AI_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });

    const { score, feedback, details } = response.data;

    console.log(`[AI Service] Evaluation complete — Score: ${score}, Type: ${diagramType}`);

    return {
      score: typeof score === 'number' ? score : 0,
      feedback: feedback || 'AI evaluation complete.',
      details: details || {},
      failed: false
    };

  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message || 'Unknown error';
    console.error("[AI Service] Evaluation error:", errMsg);
    return {
      score: 0,
      feedback: `AI evaluation failed: ${errMsg}`,
      details: {},
      failed: true
    };
  }
}

/**
 * Evaluates an essay answer using the Python AI semantic processing service.
 * @param {string} question - Question text.
 * @param {string} modelAnswer - Reference answer.
 * @param {string} studentAnswer - Candidate answer.
 * @param {number} maxScore - Points available.
 * @returns {Promise<{score: number, feedback: string, details: object, failed: boolean}>}
 */
async function evaluateEssayWithAI(question, modelAnswer, studentAnswer, maxScore) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/evaluate-essay`, {
      question,
      modelAnswer,
      studentAnswer,
      maxScore
    }, {
      timeout: AI_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });

    const { score, feedback, details } = response.data;

    return {
      score: typeof score === 'number' ? score : 0,
      feedback: feedback || 'Semantic review complete.',
      details: details || {},
      failed: false
    };
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message || 'Unknown error';
    return {
      score: 0,
      feedback: `AI Semantic Review failed: ${errMsg}`,
      details: {},
      failed: true
    };
  }
}

/**
 * Evaluates a math question using the Python AI math processing service.
 * @param {string} question - Question text.
 * @param {string} modelAnswer - Reference final answer.
 * @param {string} studentAnswer - Student final answer.
 * @param {Array} modelSteps - List of model solution steps.
 * @param {string} studentSteps - Student solution steps text.
 * @param {number} maxScore - Points available.
 * @param {number} tolerance - Numeric tolerance for final answer.
 * @param {string} gradingMode - 'final_answer' or 'checkpoints'.
 * @param {Array} checkpoints - Array of checkpoint strings.
 * @returns {Promise<{score: number, feedback: string, details: object, failed: boolean}>}
 */
async function evaluateMathWithAI(question, modelAnswer, studentAnswer, modelSteps, studentSteps, maxScore, tolerance = 0.01, gradingMode = 'final_answer', checkpoints = []) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/evaluate-math`, {
      question,
      modelAnswer,
      studentAnswer,
      modelSteps: modelSteps || [],
      studentSteps: studentSteps || "",
      maxScore,
      tolerance,
      gradingMode,
      checkpoints
    }, {
      timeout: AI_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });

    const { score, feedback, details } = response.data;

    return {
      score: typeof score === 'number' ? score : 0,
      feedback: feedback || 'Math review complete.',
      details: details || {},
      failed: false
    };
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message || 'Unknown error';
    return {
      score: 0,
      feedback: `AI Math Review failed: ${errMsg}`,
      details: {},
      failed: true
    };
  }
}

module.exports = { evaluateDiagramWithAI, evaluateEssayWithAI, evaluateMathWithAI };
