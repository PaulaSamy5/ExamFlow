/**
 * Essay AI Grading Service
 * Orchestrates semantic evaluation using defined utilities and constants.
 */

const { GRADING_STATUS, SIMILARITY_THRESHOLDS, BANDS } = require('../../constants/aiGrading.constants');
const { normalizeText } = require('../../utils/textNormalization.util');
const { validateEssayInput } = require('../../utils/essayValidation.util');
const { mapToNumericScore } = require('../../utils/scoreMapper.util');
const { hasContradiction } = require('../../utils/contradictionDetector.util');

const { evaluateEssayWithAI } = require('../../services/aiEvaluation');

/**
 * Perform semantic matching using token overlap + semantic normalization. (Local Fallback)
 */
const compareSemantically = (s1, s2) => {
  const norm1 = normalizeText(s1).split(' ').filter(t => t.length > 2);
  const norm2 = normalizeText(s2).split(' ').filter(t => t.length > 2);

  if (norm1.length === 0 || norm2.length === 0) return 30; // Base score for non-empty

  const set1 = new Set(norm1);
  const set2 = new Set(norm2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));

  // Dice Coefficient
  const similarity = (2 * intersection.size) / (set1.size + set2.size);
  return Math.round(similarity * 100);
};

const gradeEssayAnswer = async ({ question, modelAnswer, studentAnswer, maxScore }) => {
  // 1. Validation
  const validation = validateEssayInput({ modelAnswer, studentAnswer, maxScore });
  if (!validation.isValid) {
    throw new Error(`Grading Failure: ${validation.errors.join(' | ')}`);
  }

  // 2. Attempt AI Evaluation (Semantic Intelligence)
  const aiResult = await evaluateEssayWithAI(question, modelAnswer, studentAnswer, maxScore);

  if (!aiResult.failed) {
    return {
      similarity: aiResult.details?.similarity || 0,
      score: aiResult.score,
      reason: aiResult.feedback,
      isContradicting: aiResult.details?.isContradicting || false,
      status: GRADING_STATUS.PENDING_REVIEW
    };
  }

  // 3. Fallback to Local Semantic Analysis
  let similarity = compareSemantically(studentAnswer, modelAnswer);
  let isContradicting = hasContradiction(studentAnswer, modelAnswer);

  if (isContradicting && similarity > SIMILARITY_THRESHOLDS.CONTRADICTION_PENALTY) {
     similarity -= SIMILARITY_THRESHOLDS.CONTRADICTION_PENALTY;
  }

  const finalScore = mapToNumericScore(similarity, maxScore);
  const band = BANDS.find(b => similarity >= b.min) || BANDS[BANDS.length - 1];
  
  const reason = `[Fallback] ${isContradicting 
     ? `Potential contradiction detected. Semantic overlap adjusted to ${similarity}% (${band.label}).` 
     : `Semantic match established at ${similarity}% (${band.label}).`}`;

  return {
    similarity,
    score: finalScore,
    reason,
    isContradicting,
    status: GRADING_STATUS.PENDING_REVIEW
  };
};

module.exports = {
  gradeEssayAnswer
};
