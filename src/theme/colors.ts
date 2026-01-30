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

  // Colores para tarjetas de préstamos
  loanColors: [
    '#6366F1', // Índigo
    '#8B5CF6', // Púrpura
    '#EC4899', // Rosa
    '#14B8A6', // Turquesa
    '#F97316', // Naranja
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
