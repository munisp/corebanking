// src/utils/textCaseUtils.ts
// Utility functions for text case management

/**
 * Converts a string to uppercase.
 */
export function toUpperCase(str: string): string {
  return str.toUpperCase();
}

/**
 * Converts a string to lowercase.
 */
export function toLowerCase(str: string): string {
  return str.toLowerCase();
}

/**
 * Converts a string to title case (first letter of each word capitalized).
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Converts a string to camelCase.
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (m) => m.toLowerCase());
}

/**
 * Converts a string to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Converts a string to kebab-case.
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}
