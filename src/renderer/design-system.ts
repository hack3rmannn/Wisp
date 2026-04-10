/**
 * Wisp Design System — color tokens, spacing, radii, and animation durations.
 * Single source of truth for all UI styling. Uses a warm dark palette
 * with an amber/gold accent for interactive elements and the cursor overlay.
 */
export const DS = {
  Colors: {
    // Backgrounds — layered surfaces with warm undertone
    background: '#121010',
    surface1: '#1A1616',
    surface2: '#221E1E',
    surface3: '#2B2626',
    surface4: '#332E2E',

    // Borders
    borderSubtle: '#3D3535',
    borderStrong: '#4D4444',

    // Text
    textPrimary: '#F0ECE8',
    textSecondary: '#B5ADA6',
    textTertiary: '#736B65',
    textOnAccent: '#1A1210',

    // Amber accent scale
    amber50: '#FFFBEB',
    amber100: '#FEF3C7',
    amber200: '#FDE68A',
    amber300: '#FCD34D',
    amber400: '#FBBF24',
    amber500: '#F59E0B',
    amber600: '#D97706',
    amber700: '#B45309',
    amber800: '#92400E',
    amber900: '#78350F',
    amber950: '#451A03',

    // Accent (derived from amber scale)
    accent: '#F59E0B',
    accentHover: '#D97706',
    accentText: '#FBBF24',

    // Semantic
    destructive: '#E5484D',
    destructiveHover: '#F2555A',
    destructiveText: '#FF6369',
    success: '#34D399',
    warning: '#FFB224',

    // The overlay cursor color — a warm, glowing amber
    overlayCursor: '#FBBF24',
    // Speech bubble color — distinct from cursor
    speechBubble: '#1A1210',
    speechBubbleBorder: '#FBBF24',
  },

  Fonts: {
    overlay: "'Segoe UI', 'Inter', sans-serif",
    panel: "'Segoe UI', 'Inter', sans-serif",
  },

  Spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  CornerRadius: {
    small: 6,
    medium: 8,
    large: 10,
    extraLarge: 12,
    pill: 9999,
  },

  Animation: {
    fast: 0.15,
    normal: 0.25,
    slow: 0.4,
  },
} as const
