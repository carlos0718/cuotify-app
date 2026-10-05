import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorFallback } from '../ErrorFallback';

describe('ErrorFallback', () => {
  it('renderiza el título y el mensaje genérico', async () => {
    await render(<ErrorFallback error={new Error('boom')} retry={jest.fn()} />);

    expect(screen.getByText('Algo salió mal')).toBeTruthy();
    expect(screen.getByText(/Ocurrió un error inesperado/)).toBeTruthy();
  });

  it('en __DEV__ (default de Jest) muestra el detalle técnico del error', async () => {
    await render(<ErrorFallback error={new Error('mensaje técnico')} retry={jest.fn()} />);

    expect(screen.getByText('mensaje técnico')).toBeTruthy();
  });

  it('fuera de __DEV__ no muestra el detalle técnico del error', async () => {
    const rnGlobal = globalThis as unknown as { __DEV__: boolean };
    const originalDev = rnGlobal.__DEV__;
    rnGlobal.__DEV__ = false;

    await render(<ErrorFallback error={new Error('mensaje técnico')} retry={jest.fn()} />);

    expect(screen.queryByText('mensaje técnico')).toBeNull();

    rnGlobal.__DEV__ = originalDev;
  });

  it('presionar "Reintentar" llama al callback retry', async () => {
    const retry = jest.fn();
    await render(<ErrorFallback error={new Error('boom')} retry={retry} />);

    await fireEvent.press(screen.getByText('Reintentar'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
