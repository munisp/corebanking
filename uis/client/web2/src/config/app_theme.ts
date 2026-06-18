import type { Theme } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type { TenantConfig } from '../models/tenant';

// Helper function to lighten/darken colors
const adjustColor = (color: string, amount: number): string => {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
};

// Primary Colors (default)
const primaryColor = '#1A73E8';
const primaryDark = '#0D47A1';
const primaryLight = '#64B5F6';

// Secondary Colors
const secondaryColor = '#00C853';
const secondaryDark = '#00A843';
const secondaryLight = '#69F0AE';

// Neutral Colors
const backgroundColor = '#F5F7FA';
const surfaceColor = '#FFFFFF';
const errorColor = '#D32F2F';
const warningColor = '#FFA726';
const successColor = '#66BB6A';

// Text Colors (Light Mode)
const textPrimary = '#212121';
const textSecondary = '#757575';
// ...existing code...

// Text Colors (Dark Mode) - matching mobile app exactly
const textPrimaryDark = '#FFFFFF';
const textSecondaryDark = '#FFFFFF';
// ...existing code...

/**
 * Create a theme based on tenant branding configuration
 */
export const createTenantTheme = (tenant: TenantConfig): Theme => {
  const { branding } = tenant;
  
  return createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: branding.primary_color,
        dark: adjustColor(branding.primary_color, -40),
        light: adjustColor(branding.primary_color, 40),
      },
      secondary: {
        main: branding.secondary_color,
        dark: adjustColor(branding.secondary_color, -40),
        light: adjustColor(branding.secondary_color, 40),
      },
      background: {
        default: branding.backgroundColor,
        paper: branding.surfaceColor,
      },
      error: { main: branding.errorColor || errorColor },
      warning: { main: branding.warningColor || warningColor },
      success: { main: branding.successColor || successColor },
      text: {
        primary: branding.textPrimaryColor,
        secondary: branding.textSecondaryColor,
      },
    },
    typography: {
      fontFamily: branding.fontFamily || 'Roboto, sans-serif',
    },
    shape: { borderRadius: branding.borderRadius || 12 },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: branding.surfaceColor,
            boxShadow: 'none',
            color: branding.textPrimaryColor,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: branding.borderRadius || 12,
            height: 56,
            textTransform: 'none',
          },
          containedPrimary: {
            backgroundColor: branding.primary_color,
            color: '#fff',
          },
          outlinedPrimary: {
            borderColor: branding.primary_color,
            color: branding.primary_color,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: branding.borderRadius || 12,
              '& fieldset': { borderColor: '#E0E0E0' },
              '&:hover fieldset': { borderColor: branding.primary_color },
              '&.Mui-focused fieldset': {
                borderColor: branding.primary_color,
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: branding.surfaceColor,
            borderRadius: (branding.borderRadius || 12) + 4,
            border: '1px solid #E0E0E0',
            boxShadow: 'none',
          },
        },
      },
    },
  });
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: primaryColor, dark: primaryDark, light: primaryLight },
    secondary: { main: secondaryColor, dark: secondaryDark, light: secondaryLight },
    background: { default: backgroundColor, paper: surfaceColor },
    error: { main: errorColor },
    text: { primary: textPrimary, secondary: textSecondary },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: surfaceColor, boxShadow: 'none', color: textPrimary },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          height: 56,
          textTransform: 'none',
        },
        containedPrimary: { backgroundColor: primaryColor, color: '#fff' },
        outlinedPrimary: { borderColor: primaryColor, color: primaryColor },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': { borderColor: '#E0E0E0' },
            '&:hover fieldset': { borderColor: primaryColor },
            '&.Mui-focused fieldset': { borderColor: primaryColor, borderWidth: 2 },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: surfaceColor,
          borderRadius: 16,
          border: '1px solid #E0E0E0',
          boxShadow: 'none',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: primaryLight, dark: primaryColor, light: primaryLight },
    secondary: { main: secondaryLight, dark: secondaryColor, light: secondaryLight },
    background: { default: '#121212', paper: '#1E1E1E' },
    error: { main: errorColor },
    text: { primary: textPrimaryDark, secondary: textSecondaryDark },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { 
          backgroundColor: '#1E1E1E', 
          boxShadow: 'none', 
          color: textPrimaryDark 
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          height: 56,
          textTransform: 'none',
        },
        containedPrimary: { 
          backgroundColor: primaryLight, 
          color: '#000000' // Black text on light primary in dark mode
        },
        outlinedPrimary: { 
          borderColor: primaryLight, 
          color: primaryLight,
          borderWidth: 2,
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#2C2C2C',
            '& fieldset': { borderColor: '#404040' },
            '&:hover fieldset': { borderColor: primaryLight },
            '&.Mui-focused fieldset': { 
              borderColor: primaryLight, 
              borderWidth: 2 
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E1E1E',
          borderRadius: 16,
          border: '1px solid #404040',
          boxShadow: 'none',
        },
      },
    },
  },
});
