/**
 * Regex Security Utilities
 * Prevents ReDoS and SyntaxError: Invalid regular expression (HTTP 500)
 * when user input is passed to MongoDB $regex / RegExp search filters.
 */

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSafeRegex(value, maxLength = 100) {
  const truncated = String(value || '').trim().slice(0, maxLength);
  return new RegExp(escapeRegex(truncated), 'i');
}

module.exports = { escapeRegex, buildSafeRegex };

