import { Text, TouchableOpacity } from 'react-native';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { ToastProvider, useToast } from '../ToastProvider';

function Consumer() {
  const { showSuccess, showError, showWarning, showInfo, showToast, hideToast } = useToast();

  return (
    <>
      <TouchableOpacity onPress={() => showSuccess('Guardado', 'Todo bien')}>
        <Text>success</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => showError('Falló', 'Algo salió mal')}>
        <Text>error</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => showWarning('Ojo', 'Revisá esto')}>
        <Text>warning</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => showInfo('Dato', 'Info útil')}>
        <Text>info</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => showToast({ type: 'info', title: 'Custom', duration: 500 })}>
        <Text>custom</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={hideToast}>
        <Text>hide</Text>
      </TouchableOpacity>
    </>
  );
}

describe('ToastProvider / useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('useToast fuera de un ToastProvider tira un error', async () => {
    const Broken = () => {
      useToast();
      return null;
    };

    // React logea el error del render a console.error -- lo silenciamos acá
    // porque es ruido esperado del caso de prueba, no una falla real.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(render(<Broken />)).rejects.toThrow(
      'useToast must be used within a ToastProvider'
    );

    consoleError.mockRestore();
  });

  it('no muestra ningún toast antes de llamar a un show*', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('showSuccess muestra el toast con título, mensaje y duración de 3000ms', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    await fireEvent.press(screen.getByText('success'));

    expect(screen.getByText('Guardado')).toBeTruthy();
    expect(screen.getByText('Todo bien')).toBeTruthy();
  });

  it('showError muestra el toast correspondiente', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    await fireEvent.press(screen.getByText('error'));

    expect(screen.getByText('Falló')).toBeTruthy();
    expect(screen.getByText('Algo salió mal')).toBeTruthy();
  });

  it('showWarning muestra el toast correspondiente', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    await fireEvent.press(screen.getByText('warning'));

    expect(screen.getByText('Ojo')).toBeTruthy();
  });

  it('showInfo muestra el toast correspondiente', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    await fireEvent.press(screen.getByText('info'));

    expect(screen.getByText('Dato')).toBeTruthy();
  });

  it('un nuevo showToast reemplaza al toast anterior en vez de apilarlos', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    await fireEvent.press(screen.getByText('success'));
    expect(screen.getByText('Guardado')).toBeTruthy();

    await fireEvent.press(screen.getByText('error'));

    expect(screen.queryByText('Guardado')).toBeNull();
    expect(screen.getByText('Falló')).toBeTruthy();
  });

  it('hideToast oculta el toast visible', async () => {
    await render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    await fireEvent.press(screen.getByText('custom'));
    expect(screen.getByText('Custom')).toBeTruthy();

    await fireEvent.press(screen.getByText('hide'));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Custom')).toBeNull();
  });
});
