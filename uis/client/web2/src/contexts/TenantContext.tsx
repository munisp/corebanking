/* eslint-disable react-refresh/only-export-components */
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TenantConfig } from '../models/tenant';
import { DEFAULT_TENANT } from '../models/tenant';
import { TenantService } from '../services/tenant_service';

// Helper functions to lighten/darken colors for theme shades
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const lightenColor = (color: string, amount: number): string => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const r = Math.min(255, rgb.r + (255 - rgb.r) * amount);
  const g = Math.min(255, rgb.g + (255 - rgb.g) * amount);
  const b = Math.min(255, rgb.b + (255 - rgb.b) * amount);
  return rgbToHex(r, g, b);
};

const darkenColor = (color: string, amount: number): string => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const r = Math.max(0, rgb.r * (1 - amount));
  const g = Math.max(0, rgb.g * (1 - amount));
  const b = Math.max(0, rgb.b * (1 - amount));
  return rgbToHex(r, g, b);
};

interface TenantContextType {
  tenant: TenantConfig;
  setTenant: (tenant: TenantConfig) => void;
  loadTenant: (tenantId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
  initialTenant?: TenantConfig;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, initialTenant }) => {
  // Try to load cached tenant first for smoother UX
  // Only use DEFAULT_TENANT if absolutely nothing is available (avoid applying default colors)
  const initialCachedTenant = initialTenant || TenantService.loadTenantConfig();
  
  // Set title and favicon immediately (synchronously) to avoid flash
  if (typeof document !== 'undefined' && initialCachedTenant) {
    const tenantName = initialCachedTenant.displayName || initialCachedTenant.name || '54link-dev';
    document.title = tenantName;
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (favicon && initialCachedTenant.favicon) {
      favicon.href = initialCachedTenant.favicon;
    }
  }
  
  // Only use DEFAULT_TENANT as initial state if no cached tenant exists
  // This prevents default colors from being applied before real tenant loads
  const [tenant, setTenantState] = useState<TenantConfig>(initialCachedTenant || DEFAULT_TENANT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Don't apply colors if we're using default and haven't loaded real tenant yet
  const [isUsingDefault, setIsUsingDefault] = useState<boolean>(!initialCachedTenant);

  // Apply tenant branding CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const { branding } = tenant;
    
    // Always apply tenant colors - if tenant is loaded, use it
    // This ensures real tenant config overrides default
    console.log('[TenantContext] Applying tenant colors:', {
      tenantName: tenant.name,
      primaryColor: branding.primary_color,
      secondaryColor: branding.secondary_color,
      isUsingDefault,
      brandingObject: branding,
    });
    
    // Check if dark mode is active
    const isDark = document.documentElement.classList.contains('dark');
    
    // Lighten colors by ~20% for dark mode (matching mobile app behavior)
    const lighten = (hex: string, percent: number): string => {
      if (!hex) return '#000000';
      const num = parseInt(hex?.replace('#', ''), 16);
      if (isNaN(num)) return hex;
      const r = Math.min(255, ((num >> 16) & 0xff) + Math.round((255 - ((num >> 16) & 0xff)) * percent));
      const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 - ((num >> 8) & 0xff)) * percent));
      const b = Math.min(255, (num & 0xff) + Math.round((255 - (num & 0xff)) * percent));
      return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    };

    // Core brand colors - adjust for dark mode if needed
    const primaryColor = isDark && branding.primary_color ? lighten(branding.primary_color, 0.2) : (branding.primary_color || '#1a73e8');
    const secondaryColor = isDark && branding.secondary_color ? lighten(branding.secondary_color, 0.2) : (branding.secondary_color || '#34a853');
    
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--secondary-color', secondaryColor);
    root.style.setProperty('--accent-color', branding.accentColor || primaryColor);
    
    // Background and surface colors - use tenant colors or defaults based on mode
    if (isDark) {
      root.style.setProperty('--background-color', branding.backgroundColor || '#121212');
      root.style.setProperty('--surface-color', branding.surfaceColor || '#1E1E1E');
      root.style.setProperty('--text-primary-color', branding.textPrimaryColor || '#E3E3E3');
      root.style.setProperty('--text-secondary-color', branding.textSecondaryColor || '#B0B0B0');
    } else {
      root.style.setProperty('--background-color', branding.backgroundColor || '#F5F7FA');
      root.style.setProperty('--surface-color', branding.surfaceColor || '#FFFFFF');
      root.style.setProperty('--text-primary-color', branding.textPrimaryColor || '#212121');
      root.style.setProperty('--text-secondary-color', branding.textSecondaryColor || '#757575');
    }
    
    root.style.setProperty('--error-color', branding.errorColor || '#D32F2F');
    root.style.setProperty('--warning-color', branding.warningColor || '#FFA726');
    root.style.setProperty('--success-color', branding.successColor || '#66BB6A');

    // Tailwind-compatible color variables for easy theming
    // Primary color shades (equivalent to blue-50, blue-100, etc.)
    // Use the adjusted primary color (for dark mode if applicable)
    root.style.setProperty('--color-primary-50', lightenColor(primaryColor, 0.9));
    root.style.setProperty('--color-primary-100', lightenColor(primaryColor, 0.8));
    root.style.setProperty('--color-primary-200', lightenColor(primaryColor, 0.6));
    root.style.setProperty('--color-primary-300', lightenColor(primaryColor, 0.4));
    root.style.setProperty('--color-primary-400', lightenColor(primaryColor, 0.2));
    root.style.setProperty('--color-primary-500', primaryColor);
    root.style.setProperty('--color-primary-600', darkenColor(primaryColor, 0.1));
    root.style.setProperty('--color-primary-700', darkenColor(primaryColor, 0.2));
    root.style.setProperty('--color-primary-800', darkenColor(primaryColor, 0.3));
    root.style.setProperty('--color-primary-900', darkenColor(primaryColor, 0.4));

    // Secondary color shades - use adjusted secondary color
    root.style.setProperty('--color-secondary-50', lightenColor(secondaryColor, 0.9));
    root.style.setProperty('--color-secondary-100', lightenColor(secondaryColor, 0.8));
    root.style.setProperty('--color-secondary-500', secondaryColor);
    root.style.setProperty('--color-secondary-600', darkenColor(secondaryColor, 0.1));
    root.style.setProperty('--color-secondary-700', darkenColor(secondaryColor, 0.2));

    // Border radius
    if (branding.borderRadius !== undefined) {
      root.style.setProperty('--border-radius', `${branding.borderRadius}px`);
      root.style.setProperty('--border-radius-lg', `${(branding.borderRadius || 12) + 4}px`);
      root.style.setProperty('--border-radius-xl', `${(branding.borderRadius || 12) + 8}px`);
    }

    // Font family
    if (branding.fontFamily) {
      root.style.setProperty('--font-family', branding.fontFamily);
    }

    // Custom CSS from tenant config
    if (branding.customCSS) {
      const styleId = 'tenant-custom-css';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = branding.customCSS;
    }

    // Update favicon when tenant changes (title is handled by usePageTitle hook in pages)
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (favicon) {
      favicon.href = tenant.favicon;
    }
  }, [tenant]);
  
  // Re-apply tenant colors when dark mode changes
  useEffect(() => {
    const handleDarkModeChange = () => {
      // Re-trigger tenant color application by checking dark mode
      const root = document.documentElement;
      const isDark = root.classList.contains('dark');
      const { branding } = tenant;
      
      const lighten = (hex: string, percent: number): string => {
        const num = parseInt(hex?.replace('#', ''), 16);
        if (isNaN(num)) return hex;
        const r = Math.min(255, ((num >> 16) & 0xff) + Math.round((255 - ((num >> 16) & 0xff)) * percent));
        const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 - ((num >> 8) & 0xff)) * percent));
        const b = Math.min(255, (num & 0xff) + Math.round((255 - (num & 0xff)) * percent));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
      };
      
      const primaryColor = isDark ? lighten(branding.primary_color, 0.2) : branding.primary_color;
      const secondaryColor = isDark ? lighten(branding.secondary_color, 0.2) : branding.secondary_color;
      
      root.style.setProperty('--primary-color', primaryColor);
      root.style.setProperty('--secondary-color', secondaryColor);
      
      // Update color shades
      root.style.setProperty('--color-primary-500', primaryColor);
      root.style.setProperty('--color-secondary-500', secondaryColor);
    };
    
    // Listen for class changes on documentElement
    const observer = new MutationObserver(handleDarkModeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, [tenant, isUsingDefault]);

  const loadTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tenantConfig = await TenantService.fetchTenantConfig(tenantId);
      console.log('[TenantContext] Loaded tenant config:', {
        name: tenantConfig.name,
        primaryColor: tenantConfig.branding.primary_color,
      });
      setTenantState(tenantConfig);
      TenantService.saveTenantConfig(tenantConfig);
      setIsUsingDefault(false); // Mark that we now have a real tenant
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tenant configuration';
      setError(errorMessage);
      console.error('Error loading tenant:', err);
      
      // Only fall back to default if we don't have a cached config
      const cached = TenantService.loadTenantConfig();
      if (cached) {
        setTenantState(cached);
        setIsUsingDefault(false);
      } else {
        // Last resort: use default tenant
        setTenantState(DEFAULT_TENANT);
        setIsUsingDefault(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setTenant = useCallback((newTenant: TenantConfig) => {
    setTenantState(newTenant);
    TenantService.saveTenantConfig(newTenant);
  }, []);

  const value: TenantContextType = useMemo(
    () => ({
      tenant,
      setTenant,
      loadTenant,
      isLoading,
      error,
    }),
    [tenant, setTenant, loadTenant, isLoading, error]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
