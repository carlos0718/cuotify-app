import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PhoneInput } from '../PhoneInput';

function ControlledPhoneInput(props: Partial<React.ComponentProps<typeof PhoneInput>>) {
  const [value, setValue] = useState(props.value ?? '');
  return <PhoneInput {...props} value={value} onChange={setValue} />;
}

describe('PhoneInput', () => {
  it('renderiza el label por defecto ("Teléfono") y el país por defecto (Argentina, +54)', async () => {
    await render(<ControlledPhoneInput />);

    expect(screen.getByText('Teléfono')).toBeTruthy();
    expect(screen.getByText('+54')).toBeTruthy();
    expect(screen.getByText('🇦🇷')).toBeTruthy();
  });

  it('no renderiza el label cuando se pasa como cadena vacía', async () => {
    await render(<ControlledPhoneInput label="" />);

    expect(screen.queryByText('Teléfono')).toBeNull();
  });

  it('usa el label y el país por defecto pasados por props', async () => {
    await render(<ControlledPhoneInput label="Celular" defaultCountry="MX" />);

    expect(screen.getByText('Celular')).toBeTruthy();
    expect(screen.getByText('+52')).toBeTruthy();
    expect(screen.getByText('🇲🇽')).toBeTruthy();
  });

  it('al tipear el número llama a onChange con el E.164 (dial code + solo dígitos)', async () => {
    const onChange = jest.fn();
    await render(<PhoneInput value="" onChange={onChange} />);

    await fireEvent.changeText(
      screen.getByPlaceholderText('9 11 1234 5678'),
      '11-1234-5678'
    );

    expect(onChange).toHaveBeenCalledWith('+541112345678');
  });

  it('con el número vacío, llama a onChange con cadena vacía', async () => {
    const onChange = jest.fn();
    await render(<PhoneInput value="" onChange={onChange} />);

    await fireEvent.changeText(screen.getByPlaceholderText('9 11 1234 5678'), '');

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('no muestra el check de validación con un número corto (E.164 de 7 caracteres o menos)', async () => {
    await render(<ControlledPhoneInput />);

    await fireEvent.changeText(screen.getByPlaceholderText('9 11 1234 5678'), '123');

    expect(screen.queryByText(/^✓/)).toBeNull();
  });

  it('muestra el check de validación con un E.164 de más de 7 caracteres', async () => {
    await render(<ControlledPhoneInput />);

    await fireEvent.changeText(
      screen.getByPlaceholderText('9 11 1234 5678'),
      '11 1234 5678'
    );

    expect(screen.getByText('✓ +541112345678')).toBeTruthy();
  });

  it('abre el selector de país al presionar el botón de país', async () => {
    await render(<ControlledPhoneInput />);

    await fireEvent.press(screen.getByText('+54'));

    expect(screen.getByText('Seleccionar país')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscar país...')).toBeTruthy();
  });

  it('filtra la lista de países al buscar por nombre', async () => {
    await render(<ControlledPhoneInput />);
    await fireEvent.press(screen.getByText('+54'));

    await fireEvent.changeText(screen.getByPlaceholderText('Buscar país...'), 'chile');

    expect(screen.getByText('Chile')).toBeTruthy();
    expect(screen.queryByText('Uruguay')).toBeNull();
  });

  it('filtra la lista de países al buscar por código de marcado', async () => {
    await render(<ControlledPhoneInput />);
    await fireEvent.press(screen.getByText('+54'));

    await fireEvent.changeText(screen.getByPlaceholderText('Buscar país...'), '+56');

    expect(screen.getByText('Chile')).toBeTruthy();
    expect(screen.queryByText('Argentina')).toBeNull();
  });

  it('seleccionar un país cambia el dial code, cierra el picker y recalcula el E.164', async () => {
    const onChange = jest.fn();
    await render(<ControlledPhoneInput onChange={onChange} />);

    await fireEvent.changeText(screen.getByPlaceholderText('9 11 1234 5678'), '91112345678');
    await fireEvent.press(screen.getByText('+54'));
    await fireEvent.changeText(screen.getByPlaceholderText('Buscar país...'), 'chile');
    await fireEvent.press(screen.getByText('Chile'));

    expect(screen.queryByText('Seleccionar país')).toBeNull();
    expect(screen.getByText('+56')).toBeTruthy();
    expect(screen.getByText('🇨🇱')).toBeTruthy();
  });

  it('cerrar el picker con "✕" no cambia el país seleccionado', async () => {
    await render(<ControlledPhoneInput />);

    await fireEvent.press(screen.getByText('+54'));
    await fireEvent.press(screen.getByText('✕'));

    expect(screen.queryByText('Seleccionar país')).toBeNull();
    expect(screen.getByText('+54')).toBeTruthy();
  });
});
