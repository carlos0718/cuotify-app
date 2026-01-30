export { colors } from './colors';
export type { Colors } from './colors';

export { gradients } from './gradients';
export type { Gradients } from './gradients';

export { typography, fontFamily, fontSize, fontWeight, lineHeight } from './typography';
export type { Typography } from './typography';

export { spacing, borderRadius, shadow } from './spacing';
export type { Spacing, BorderRadius, Shadow } from './spacing';

// Theme object completo
export const theme = {
  colors: require('./colors').colors,
  gradients: require('./gradients').gradients,
  typography: require('./typography').typography,
  spacing: require('./spacing').spacing,
  borderRadius: require('./spacing').borderRadius,
  shadow: require('./spacing').shadow,
} as const;
