export const colors = {
  // Colores primarios (degradado azul/púrpura)
  primary: {
    main: '#6366F1',
    light: '#818CF8',
    dark: '#4F46E5',
  },

  // Colores secundarios
  secondary: {
    main: '#8B5CF6',
    light: '#A78BFA',
    dark: '#7C3AED',
  },

  // Estados
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Colores para tarjetas de préstamos (pasteles suaves)
  loanColors: [
    '#A5B4FC', // Índigo pastel
    '#C4B5FD', // Púrpura pastel
    '#F9A8D4', // Rosa pastel
    '#99F6E4', // Turquesa pastel
    '#FED7AA', // Naranja pastel
    '#A7F3D0', // Verde menta pastel
    '#FDE68A', // Amarillo pastel
    '#FBCFE8', // Pink pastel
    '#BAE6FD', // Celeste pastel
    '#DDD6FE', // Lavanda pastel
  ],

  // Neutros
  background: '#F8FAFC',
  surface: '#FFFFFF',

  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    disabled: '#94A3B8',
    inverse: '#FFFFFF',
  },

  border: '#E2E8F0',
  divider: '#F1F5F9',

  // Estados de pago
  payment: {
    pending: '#F59E0B',
    paid: '#10B981',
    overdue: '#EF4444',
    partial: '#3B82F6',
  },
} as const;

export type Colors = typeof colors;
