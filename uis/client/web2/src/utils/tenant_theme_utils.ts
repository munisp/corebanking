import type { TenantConfig } from '../models/tenant';

/**
 * Utility functions for tenant theming
 */

/**
 * Darken a hex color by a percentage
 */
export const darkenColor = (color: string, amount: number): string => {
  const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (rgb) {
    const r = Math.max(0, parseInt(rgb[1], 16) * (1 - amount));
    const g = Math.max(0, parseInt(rgb[2], 16) * (1 - amount));
    const b = Math.max(0, parseInt(rgb[3], 16) * (1 - amount));
    return '#' + [r, g, b].map((x) => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  return color;
};

/**
 * Lighten a hex color by a percentage
 */
export const lightenColor = (color: string, amount: number): string => {
  const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (rgb) {
    const r = Math.min(255, parseInt(rgb[1], 16) + (255 - parseInt(rgb[1], 16)) * amount);
    const g = Math.min(255, parseInt(rgb[2], 16) + (255 - parseInt(rgb[2], 16)) * amount);
    const b = Math.min(255, parseInt(rgb[3], 16) + (255 - parseInt(rgb[3], 16)) * amount);
    return '#' + [r, g, b].map((x) => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  return color;
};

/**
 * Get tenant-themed inline styles
 */
export const getTenantStyles = (tenant: TenantConfig) => {
  return {
    primary: {
      backgroundColor: tenant.branding.primary_color,
      color: '#ffffff',
    },
    primaryHover: {
      backgroundColor: darkenColor(tenant.branding.primary_color, 0.1),
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: tenant.branding.secondary_color,
      color: '#ffffff',
    },
    background: {
      backgroundColor: tenant.branding.backgroundColor,
    },
    surface: {
      backgroundColor: tenant.branding.surfaceColor,
    },
    textPrimary: {
      color: tenant.branding.textPrimaryColor,
    },
    textSecondary: {
      color: tenant.branding.textSecondaryColor,
    },
    gradient: {
      background: `linear-gradient(to bottom right, ${darkenColor(tenant.branding.primary_color, 0.2)}, ${tenant.branding.primary_color})`,
    },
  };
};

/**
 * Get Tailwind-compatible classes using CSS variables
 * These work with Tailwind v4's arbitrary value syntax
 */
export const getTenantClasses = () => {
  return {
    bgPrimary: 'bg-[var(--primary-color)]',
    bgPrimaryLight: 'bg-[var(--color-primary-100)]',
    bgPrimaryDark: 'bg-[var(--color-primary-700)]',
    textPrimary: 'text-[var(--primary-color)]',
    textPrimaryDark: 'text-[var(--color-primary-700)]',
    borderPrimary: 'border-[var(--primary-color)]',
    borderPrimaryLight: 'border-[var(--color-primary-200)]',
    hoverPrimary: 'hover:bg-[var(--color-primary-700)]',
    bgSecondary: 'bg-[var(--secondary-color)]',
    textSecondary: 'text-[var(--secondary-color)]',
    bgSurface: 'bg-[var(--surface-color)]',
    bgBackground: 'bg-[var(--background-color)]',
    textPrimaryColor: 'text-[var(--text-primary-color)]',
    textSecondaryColor: 'text-[var(--text-secondary-color)]',
  };
};








