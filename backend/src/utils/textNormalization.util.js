/**
 * Text Normalization Utility
 * Prepares text for semantic comparison by cleaning and normalizing formats.
 */

const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
    .replace(/[^\w\s\u0621-\u064A]/g, '') // Remove punctuation but keep Alphanumeric + Arabic chars
    .trim();
};

module.exports = {
  normalizeText
};
