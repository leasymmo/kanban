/**
 * Design Tokens centralisés de Carré d'Hôtes (Direction A : Apple Liquid Glass).
 * Ces valeurs reflètent exactement les variables CSS définies dans `src/styles/tokens.css`.
 */

export const CDH_COLORS = {
  light: {
    accent: '#007AFF',
    accentHover: '#0066D6',
    secondary: '#5856D6',
    canvas: '#F2F4F8',
    textPrimary: '#1D1D1F',
    textSecondary: '#5E626B',
    textTertiary: '#7E8490',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
  },
  dark: {
    accent: '#0A84FF',
    accentHover: '#409CFF',
    secondary: '#5E5CE6',
    canvas: '#0B0F17',
    textPrimary: '#F5F5F7',
    textSecondary: '#A1A7B3',
    textTertiary: '#717886',
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
  },
} as const;

export const CDH_GLASS_LAYERS = {
  canvas: 'cdh-canvas-bg',
  column: 'cdh-glass-column',
  card: 'cdh-surface-card',
  chrome: 'cdh-glass-chrome',
  overlay: 'cdh-glass-overlay',
} as const;

export const CDH_RADII = {
  xs: '6px',
  sm: '8px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '22px',
  pill: '9999px',
} as const;

export const CDH_MOTION = {
  spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  fastMs: 140,
  baseMs: 200,
  slowMs: 280,
} as const;

export type GlassLayer = keyof typeof CDH_GLASS_LAYERS;
