import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no renderiza nada cuando visible es false', async () => {
    await render(
      <Toast visible={false} type="info" title="Título" onHide={jest.fn()} />
    );

    expect(screen.toJSON()).toBeNull();
  });

  it('renderiza el título y el ícono correspondiente al tipo', async () => {
    await render(
      <Toast visible type="success" title="Guardado" onHide={jest.fn()} />
    );

    expect(screen.getByText('Guardado')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('renderiza el mensaje solo cuando se pasa la prop message', async () => {
    const { rerender } = await render(
      <Toast visible type="error" title="Error" onHide={jest.fn()} />
    );
    expect(screen.queryByText('Detalle')).toBeNull();

    await rerender(
      <Toast visible type="error" title="Error" message="Detalle" onHide={jest.fn()} />
    );
    expect(screen.getByText('Detalle')).toBeTruthy();
  });

  it('usa el ícono correcto para cada tipo', async () => {
    const icons: Record<string, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    for (const [type, icon] of Object.entries(icons)) {
      const { unmount } = await render(
        <Toast visible type={type as never} title="T" onHide={jest.fn()} />
      );
      expect(screen.getByText(icon)).toBeTruthy();
      await unmount();
    }
  });

  it('llama a onHide después de que termine la animación al tocar la pill', async () => {
    const onHide = jest.fn();
    await render(<Toast visible type="info" title="Título" onHide={onHide} />);

    await fireEvent.press(screen.getByText('Título'));

    // Solo avanzamos lo que dura la animación de salida (240ms) -- no usamos
    // runAllTimers() porque también dispararía el setTimeout de auto-hide a
    // los 3000ms (duration por defecto), contando un onHide de más.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('se auto-oculta pasado el "duration" configurado', async () => {
    const onHide = jest.fn();
    await render(
      <Toast visible type="info" title="Título" duration={1000} onHide={onHide} />
    );

    expect(onHide).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      jest.runAllTimers();
    });

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('usa 3000ms de duración por defecto', async () => {
    const onHide = jest.fn();
    await render(<Toast visible type="info" title="Título" onHide={onHide} />);

    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(onHide).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      jest.runAllTimers();
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
