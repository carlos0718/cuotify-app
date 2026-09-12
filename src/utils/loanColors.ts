import { colors } from '../theme';

const pastelColors = colors.loanColors;

/**
 * Obtiene el siguiente color de la paleta, diferente al último usado
 * @param lastColor - El último color usado (opcional)
 * @returns Un color pastel diferente al anterior
 */
export function getNextLoanColor(lastColor?: string | null): string {
  if (!lastColor) {
    // Si no hay color previo, devolver el primero
    return pastelColors[0];
  }

  // Encontrar el índice del último color usado. Cast a readonly string[]:
  // pastelColors es una tupla de literales (colors.loanColors usa `as const`),
  // pero lastColor viene de la DB como string genérico.
  const lastIndex = (pastelColors as readonly string[]).indexOf(lastColor);

  if (lastIndex === -1) {
    // Si el color no está en la paleta, devolver el primero
    return pastelColors[0];
  }

  // Devolver el siguiente color (con ciclo)
  const nextIndex = (lastIndex + 1) % pastelColors.length;
  return pastelColors[nextIndex];
}

/**
 * Obtiene un color basado en el índice del préstamo
 * Útil para asignar colores de forma determinista
 * @param index - Índice del préstamo (0, 1, 2, ...)
 * @returns Un color pastel de la paleta
 */
export function getLoanColorByIndex(index: number): string {
  return pastelColors[index % pastelColors.length];
}

/**
 * Obtiene un color aleatorio diferente al proporcionado
 * @param excludeColor - Color a excluir (opcional)
 * @returns Un color pastel aleatorio
 */
export function getRandomLoanColor(excludeColor?: string | null): string {
  const availableColors = excludeColor
    ? pastelColors.filter(c => c !== excludeColor)
    : pastelColors;

  const randomIndex = Math.floor(Math.random() * availableColors.length);
  return availableColors[randomIndex];
}
