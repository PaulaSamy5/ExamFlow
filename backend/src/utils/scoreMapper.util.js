/**
 * Score Mapper Utility
 * Translates similarity percentages into points based on question maxScore.
 */

const { BANDS } = require('../constants/aiGrading.constants');

const mapToNumericScore = (similarity, maxScore) => {
  if (similarity >= 100) return maxScore;
  if (similarity <= 0) return 0;

  // Find corresponding band
  const band = BANDS.find(b => similarity >= b.min);
  const factor = band ? band.factor : 0;

  // Precise Calculation: (similarity / 100) * maxScore, but weighted by band
  // Alternatively, just a simple weighted factor
  const rawEarned = (similarity / 100) * maxScore * factor;
  
  // High fidelity results are always rounded to 2 decimals
  return Math.round(rawEarned * 100) / 100;
};

module.exports = {
  mapToNumericScore
};
