import { useTenantConfig } from './useTenantConfig';

/**
 * Hook to get tenant-themed Tailwind CSS classes
 * Provides utility functions for applying tenant branding throughout the app
 */
export const useTenantTheme = () => {
  const { getBrandColor, tenant } = useTenantConfig();

  /**
   * Get tenant-themed background color classes
   */
  const getBgClass = (shade: 'primary' | 'secondary' = 'primary'): string => {
    const color = shade === 'primary' ? tenant.branding.primary_color : tenant.branding.secondary_color;
    return `bg-[${color}]`;
  };

  /**
   * Get tenant-themed text color classes
   */
  const getTextClass = (shade: 'primary' | 'secondary' = 'primary'): string => {
    const color = shade === 'primary' ? tenant.branding.primary_color : tenant.branding.secondary_color;
    return `text-[${color}]`;
  };

  /**
   * Get tenant-themed border color classes
   */
  const getBorderClass = (shade: 'primary' | 'secondary' = 'primary'): string => {
    const color = shade === 'primary' ? tenant.branding.primary_color : tenant.branding.secondary_color;
    return `border-[${color}]`;
  };

  /**
   * Get inline style for primary background color
   */
  const getPrimaryBgStyle = () => ({
    backgroundColor: tenant.branding.primary_color,
  });

  /**
   * Get inline style for primary text color
   */
  const getPrimaryTextStyle = () => ({
    color: tenant.branding.primary_color,
  });

  /**
   * Get inline style for secondary background color
   */
  const getSecondaryBgStyle = () => ({
    backgroundColor: tenant.branding.secondary_color,
  });

  /**
   * Get inline style for hover state (darker version of primary)
   */
  const getPrimaryHoverStyle = () => {
    const primaryColor = tenant.branding.primary_color;
    // Darken by ~10%
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColor);
    if (rgb) {
      const r = Math.max(0, parseInt(rgb[1], 16) * 0.9);
      const g = Math.max(0, parseInt(rgb[2], 16) * 0.9);
      const b = Math.max(0, parseInt(rgb[3], 16) * 0.9);
      return {
        backgroundColor: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
      };
    }
    return { backgroundColor: primaryColor };
  };

  /**
   * Get CSS variable-based classes for Tailwind (works with arbitrary values)
   */
  const themeClasses = {
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

  return {
    getBrandColor,
    getBgClass,
    getTextClass,
    getBorderClass,
    getPrimaryBgStyle,
    getPrimaryTextStyle,
    getSecondaryBgStyle,
    getPrimaryHoverStyle,
    themeClasses,
    tenant,
  };
};








