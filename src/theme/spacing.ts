import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export interface ShadowStyle {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  borderWidth?: number;
  borderColor?: string;
}

// iOS usa shadow* (suave y difuminada). Android usa elevation (sombra del sistema, más pesada)
// En Android bajamos elevation al mínimo y usamos un borde sutil para dar profundidad sin sombra opaca.
const iosShadow: Record<'sm' | 'md' | 'lg' | 'xl', ShadowStyle> = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 0 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 0 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 0 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 0 },
};

const androidShadow: Record<'sm' | 'md' | 'lg' | 'xl', ShadowStyle> = {
  sm: { elevation: 1 },
  md: { elevation: 2 },
  lg: { elevation: 3 },
  xl: { elevation: 5 },
};

export const shadow = Platform.OS === 'android' ? androidShadow : iosShadow;

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadow = typeof shadow;
