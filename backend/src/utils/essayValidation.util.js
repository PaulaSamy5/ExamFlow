/**
 * Essay Validation Utility
 * Ensures data integrity before grading logic starts.
 */

const validateEssayInput = ({ modelAnswer, studentAnswer, maxScore }) => {
  const errors = [];

  if (!modelAnswer || typeof modelAnswer !== 'string' || modelAnswer.trim().length === 0) {
    errors.push('Reference model answer is missing or incomplete.');
  }

  if (studentAnswer === undefined || studentAnswer === null) {
     errors.push('Student response candidate is null/undefined.');
  }

  if (typeof maxScore !== 'number' || maxScore <= 0) {
     errors.push('Invalid maximum points assigned to this question.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateEssayInput
};
