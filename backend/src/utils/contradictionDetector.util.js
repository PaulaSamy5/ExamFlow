/**
 * Contradiction Detector Utility
 * Identifies potential meaning reversals between candidate and reference.
 */

const { normalizeText } = require('./textNormalization.util');

const NEGATION_WORDS = ['not', 'never', 'no', 'none', 'neither', 'nor', 'don\'t', 'doesn\'t', 'won\'t', 'isn\'t', 'aren\'t'];

const hasContradiction = (s1, s2) => {
  const norm1 = normalizeText(s1).split(' ');
  const norm2 = normalizeText(s2).split(' ');

  const countNegations = (tokens) => tokens.filter(t => NEGATION_WORDS.includes(t)).length;

  const neg1 = countNegations(norm1);
  const neg2 = countNegations(norm2);

  // If one has odd vs even negations, meaning is likely reversed
  const isReversed = (neg1 % 2) !== (neg2 % 2);

  // Additionally check for "but", "however", "mismatch" if necessary 
  // For basic refactoring, this parity checker is a reliable start.
  return isReversed;
};

module.exports = {
  hasContradiction
};
