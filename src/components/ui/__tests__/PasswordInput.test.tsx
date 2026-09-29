import { render, screen, fireEvent } from '@testing-library/react-native';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput', () => {
  it('oculta el texto por defecto (secureTextEntry true)', async () => {
    await render(<PasswordInput placeholder="Contraseña" />);

    const input = screen.getByPlaceholderText('Contraseña');
    expect(input.props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('Mostrar contraseña')).toBeTruthy();
  });

  it('muestra el texto al presionar el botón de alternar y lo vuelve a ocultar al presionarlo de nuevo', async () => {
    await render(<PasswordInput placeholder="Contraseña" />);

    const input = screen.getByPlaceholderText('Contraseña');

    await fireEvent.press(screen.getByLabelText('Mostrar contraseña'));
    expect(input.props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Ocultar contraseña')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Ocultar contraseña'));
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('fuerza autoCapitalize="none" y autoCorrect={false} sin importar lo que se le pase', async () => {
    await render(
      <PasswordInput placeholder="Contraseña" autoCapitalize="words" autoCorrect />
    );

    const input = screen.getByPlaceholderText('Contraseña');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
  });

  it('propaga el resto de props de TextInput, como onChangeText y value', async () => {
    const onChangeText = jest.fn();
    await render(
      <PasswordInput placeholder="Contraseña" value="abc123" onChangeText={onChangeText} />
    );

    const input = screen.getByPlaceholderText('Contraseña');
    expect(input.props.value).toBe('abc123');

    await fireEvent.changeText(input, 'nuevoValor');
    expect(onChangeText).toHaveBeenCalledWith('nuevoValor');
  });
});
