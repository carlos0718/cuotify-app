import { getNextLoanColor, getLoanColorByIndex, getRandomLoanColor } from '../loanColors';
import { colors } from '../../theme';

const palette = colors.loanColors;

describe('getNextLoanColor', () => {
  it('devuelve el primer color cuando no hay color previo', () => {
    expect(getNextLoanColor(undefined)).toBe(palette[0]);
    expect(getNextLoanColor(null)).toBe(palette[0]);
  });

  it('devuelve el siguiente color de la paleta', () => {
    expect(getNextLoanColor(palette[0])).toBe(palette[1]);
    expect(getNextLoanColor(palette[3])).toBe(palette[4]);
  });

  it('cicla al primer color al llegar al final de la paleta', () => {
    const lastColor = palette[palette.length - 1];
    expect(getNextLoanColor(lastColor)).toBe(palette[0]);
  });

  it('devuelve el primer color si el color recibido no está en la paleta', () => {
    expect(getNextLoanColor('#000000')).toBe(palette[0]);
  });
});

describe('getLoanColorByIndex', () => {
  it('devuelve el color correspondiente al índice', () => {
    expect(getLoanColorByIndex(0)).toBe(palette[0]);
    expect(getLoanColorByIndex(2)).toBe(palette[2]);
  });

  it('cicla con módulo cuando el índice supera el largo de la paleta', () => {
    expect(getLoanColorByIndex(palette.length)).toBe(palette[0]);
    expect(getLoanColorByIndex(palette.length + 2)).toBe(palette[2]);
  });
});

describe('getRandomLoanColor', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('devuelve un color de la paleta completa cuando no hay exclusión', () => {
    Math.random = () => 0; // primer elemento del array disponible
    expect(getRandomLoanColor()).toBe(palette[0]);
  });

  it('nunca devuelve el color excluido', () => {
    const excluded = palette[2];
    const filteredLength = palette.length - 1;

    // Recorremos todos los índices posibles del array filtrado (sin el excluido)
    for (let i = 0; i < filteredLength; i++) {
      Math.random = () => i / filteredLength;
      const result = getRandomLoanColor(excluded);
      expect(result).not.toBe(excluded);
    }
  });

  it('elige del array filtrado (sin el color excluido) según el índice random', () => {
    const excluded = palette[0];
    const filtered = palette.filter((c) => c !== excluded);
    Math.random = () => 0;
    expect(getRandomLoanColor(excluded)).toBe(filtered[0]);
  });
});
