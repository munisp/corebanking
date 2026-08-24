/**
 * M-52: PII masking helpers for log lines.
 *
 * KYC flows handle government identifiers (NIN/UIN/BVN) and holder names that
 * must never appear in cleartext in application logs. These helpers produce a
 * deterministic masked rendering of an identifier so log entries remain
 * correlatable (same input -> same masked output) without disclosing the PII
 * itself.
 */

/**
 * Mask an identifier, keeping at most the last `visibleLast` characters.
 *
 * - Deterministic: the same input always yields the same masked output.
 * - No PII beyond the last `visibleLast` chars: for inputs not longer than
 *   `visibleLast` the value is fully masked (a short identifier IS the PII).
 * - null/undefined/empty inputs render as fixed placeholders, never throw.
 *
 * Examples (visibleLast = 3):
 *   "12345678901" -> "********901"
 *   "ab"          -> "**"
 *   undefined     -> "[none]"
 */
export function maskIdentifier(
  value: string | null | undefined,
  visibleLast: number = 3,
): string {
  if (value === null || value === undefined) {
    return "[none]";
  }
  const s = String(value);
  if (s.length === 0) {
    return "[empty]";
  }
  if (visibleLast < 0) {
    visibleLast = 0;
  }
  if (visibleLast === 0 || s.length <= visibleLast) {
    return "*".repeat(s.length);
  }
  return "*".repeat(s.length - visibleLast) + s.slice(-visibleLast);
}
