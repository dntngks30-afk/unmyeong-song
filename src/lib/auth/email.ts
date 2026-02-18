/**
 * Email normalization and validation for signup.
 * PR: musician signup INVALID_EMAIL fix
 */

const ZERO_WIDTH =
  /[\u200B-\u200D\uFEFF]/g;

/**
 * Normalize email: trim, remove zero-width chars, lowercase.
 */
export function normalizeEmail(email: string): string {
  return email
    .replace(ZERO_WIDTH, "")
    .trim()
    .toLowerCase();
}

/**
 * Basic email format validation. Permissive local@domain.tld pattern.
 */
export function validateEmailFormat(normalized: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

/**
 * Sanitized preview for debug logging (replace non-ASCII with ?).
 */
export function emailDebugPreview(email: string): string {
  return email.replace(/[^\x20-\x7E]/g, "?");
}
