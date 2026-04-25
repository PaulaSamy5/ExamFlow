/**
 * AI Grading Constants
 * Centralized configuration for semantic thresholds and status tags.
 */

const GRADING_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  AUTO_RELEASED: 'auto_released'
};

const SIMILARITY_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  AVERAGE: 50,
  POOR: 25,
  CONTRADICTION_PENALTY: 40 // Percentage reduction if contradiction detected
};

const BANDS = [
  { min: 90, factor: 1.0, label: 'Full / Near-Full' },
  { min: 75, factor: 0.85, label: 'High Score' },
  { min: 50, factor: 0.65, label: 'Medium Score' },
  { min: 25, factor: 0.35, label: 'Low Score' },
  { min: 0,  factor: 0.1,  label: 'Very Low / Irrelevant' }
];

module.exports = {
  GRADING_STATUS,
  SIMILARITY_THRESHOLDS,
  BANDS
};
