import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('no renderiza contenido cuando visible es false', async () => {
    await render(
      <Modal visible={false} onClose={jest.fn()} title="Título" />
    );

    expect(screen.queryByText('Título')).toBeNull();
  });

  it('renderiza el título y el mensaje cuando visible es true', async () => {
    await render(
      <Modal visible onClose={jest.fn()} title="Confirmar" message="¿Estás seguro?" />
    );

    expect(screen.getByText('Confirmar')).toBeTruthy();
    expect(screen.getByText('¿Estás seguro?')).toBeTruthy();
  });

  it('renderiza el ícono solo cuando se pasa la prop icon', async () => {
    const { rerender } = await render(
      <Modal visible onClose={jest.fn()} title="Título" />
    );
    expect(screen.queryByText('⚠️')).toBeNull();

    await rerender(<Modal visible onClose={jest.fn()} title="Título" icon="⚠️" />);
    expect(screen.getByText('⚠️')).toBeTruthy();
  });

  it('usa el botón "Cerrar" por defecto y llama a onClose al presionarlo', async () => {
    const onClose = jest.fn();
    await render(<Modal visible onClose={onClose} title="Título" />);

    await fireEvent.press(screen.getByText('Cerrar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renderiza todos los botones pasados con sus textos', async () => {
    await render(
      <Modal
        visible
        onClose={jest.fn()}
        title="Eliminar préstamo"
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: jest.fn() },
        ]}
      />
    );

    expect(screen.getByText('Cancelar')).toBeTruthy();
    expect(screen.getByText('Eliminar')).toBeTruthy();
  });

  it('un botón con onPress llama a ese callback sin cerrar el modal', async () => {
    const onClose = jest.fn();
    const onPress = jest.fn();
    await render(
      <Modal
        visible
        onClose={onClose}
        title="Título"
        buttons={[{ text: 'Guardar', style: 'primary', onPress }]}
      />
    );

    await fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('un botón sin onPress siempre cierra el modal, aunque no sea "cancel"', async () => {
    const onClose = jest.fn();
    await render(
      <Modal
        visible
        onClose={onClose}
        title="Título"
        buttons={[{ text: 'Entendido', style: 'primary' }]}
      />
    );

    await fireEvent.press(screen.getByText('Entendido'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un botón "cancel" con onPress ejecuta el callback y también cierra el modal', async () => {
    const onClose = jest.fn();
    const onPress = jest.fn();
    await render(
      <Modal
        visible
        onClose={onClose}
        title="Título"
        buttons={[{ text: 'Cancelar', style: 'cancel', onPress }]}
      />
    );

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renderiza children personalizados', async () => {
    await render(
      <Modal visible onClose={jest.fn()} title="Título">
        <Text>Contenido personalizado</Text>
      </Modal>
    );

    expect(screen.getByText('Contenido personalizado')).toBeTruthy();
  });
});
