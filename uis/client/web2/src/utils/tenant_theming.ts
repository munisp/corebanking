// Utility functions for applying tenant theming to components
import type { CSSProperties } from 'react';

/**
 * Get inline styles for primary colored backgrounds
 */
export const getPrimaryBgStyle = (): CSSProperties => ({
  backgroundColor: 'var(--primary-color)',
});

/**
 * Get inline styles for secondary colored backgrounds
 */
export const getSecondaryBgStyle = (): CSSProperties => ({
  backgroundColor: 'var(--secondary-color)',
});

/**
 * Get inline styles for primary colored text
 */
export const getPrimaryTextStyle = (): CSSProperties => ({
  color: 'var(--primary-color)',
});

/**
 * Get inline styles for secondary colored text
 */
export const getSecondaryTextStyle = (): CSSProperties => ({
  color: 'var(--secondary-color)',
});

/**
 * Get inline styles for gradient backgrounds using primary and secondary colors
 */
export const getGradientBgStyle = (angle: number = 135): CSSProperties => ({
  background: `linear-gradient(${angle}deg, var(--primary-color), var(--secondary-color))`,
});

/**
 * Get inline styles for borders using primary color
 */
export const getPrimaryBorderStyle = (): CSSProperties => ({
  borderColor: 'var(--primary-color)',
});

/**
 * Get inline styles for borders using secondary color
 */
export const getSecondaryBorderStyle = (): CSSProperties => ({
  borderColor: 'var(--secondary-color)',
});

/**
 * Get Tailwind-compatible class string for hover effects
 * Note: Returns empty string as inline styles are preferred for dynamic colors
 */
export const getTenantHoverClass = () => 'hover:opacity-90 transition-opacity';

/**
 * Get button style with primary color
 */
export const getPrimaryButtonStyle = (): CSSProperties => ({
  backgroundColor: 'var(--primary-color)',
  color: 'white',
});

/**
 * Get button style with secondary color
 */
export const getSecondaryButtonStyle = (): CSSProperties => ({
  backgroundColor: 'var(--secondary-color)',
  color: 'white',
});

/**
 * Get outline button style with primary color
 */
export const getPrimaryOutlineButtonStyle = (): CSSProperties => ({
  borderColor: 'var(--primary-color)',
  color: 'var(--primary-color)',
});
