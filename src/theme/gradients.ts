export const gradients = {
  // Degradado principal para headers
  primary: ['#4F46E5', '#7C3AED'] as const,

  // Degradado para el header del dashboard
  header: ['#6366F1', '#8B5CF6'] as const,

  // Degradado para tarjetas
  card: ['#818CF8', '#A78BFA'] as const,

  // Degradado para botones
  button: ['#6366F1', '#7C3AED'] as const,

  // Degradado suave para fondos
  background: ['#F8FAFC', '#EEF2FF'] as const,

  // Degradados por tipo de préstamo
  loanCards: {
    personal: ['#6366F1', '#818CF8'] as const,
    business: ['#8B5CF6', '#A78BFA'] as const,
    emergency: ['#14B8A6', '#2DD4BF'] as const,
  },
} as const;

export type Gradients = typeof gradients;
