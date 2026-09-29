import { validateEmail, validatePassword, validateDNI, validatePhone } from '../validators';

describe('validateEmail', () => {
  it('rechaza un email vacío', () => {
    const result = validateEmail('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('El correo electrónico es requerido');
  });

  it('rechaza un email sin @', () => {
    const result = validateEmail('no-es-un-email');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('El formato del correo no es válido');
  });

  it('rechaza un dominio con label vacío (doble punto)', () => {
    const result = validateEmail('test@exa..mple.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('El correo contiene caracteres no válidos');
  });

  it('rechaza un dominio con guión bajo (no permitido en hostnames)', () => {
    const result = validateEmail('test@mi_dominio.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('El correo contiene caracteres no válidos');
  });

  it('acepta un email válido con TLD conocido', () => {
    const result = validateEmail('usuario@example.com');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });

  it('acepta un TLD compuesto conocido (com.ar)', () => {
    const result = validateEmail('usuario@example.com.ar');
    expect(result.isValid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('detecta un typo común de TLD y sugiere la corrección', () => {
    const result = validateEmail('usuario@example.con');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('¿Quisiste decir ".com"?');
    expect(result.suggestion).toBe('usuario@example.com');
  });

  it('avisa (sin bloquear) cuando el TLD es poco común pero similar a uno conocido', () => {
    const result = validateEmail('usuario@example.cot');
    expect(result.isValid).toBe(true);
    expect(result.warning).toContain('¿Quisiste decir ".com"?');
    expect(result.suggestion).toBe('usuario@example.com');
  });

  it('avisa (sin bloquear ni sugerir) cuando el TLD no se parece a ninguno conocido', () => {
    const result = validateEmail('usuario@example.zzzzz');
    expect(result.isValid).toBe(true);
    expect(result.warning).toBe('El dominio ".zzzzz" es poco común, pero se puede continuar');
    expect(result.suggestion).toBeUndefined();
  });

  it('normaliza mayúsculas y espacios antes de validar', () => {
    const result = validateEmail('  Usuario@Example.COM  ');
    expect(result.isValid).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});

describe('validatePassword', () => {
  it('rechaza una contraseña vacía', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('La contraseña es requerida');
  });

  it('rechaza una contraseña de menos de 6 caracteres', () => {
    const result = validatePassword('abc12');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('La contraseña debe tener al menos 6 caracteres');
  });

  it('acepta una contraseña de exactamente 6 caracteres', () => {
    const result = validatePassword('abc123');
    expect(result.isValid).toBe(true);
  });
});

describe('validateDNI', () => {
  it('es válido cuando está vacío (campo opcional)', () => {
    expect(validateDNI('')).toEqual({ isValid: true });
  });

  it('rechaza un DNI de menos de 7 dígitos', () => {
    const result = validateDNI('123456');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('El DNI debe tener entre 7 y 8 dígitos');
  });

  it('rechaza un DNI de más de 8 dígitos', () => {
    const result = validateDNI('123456789');
    expect(result.isValid).toBe(false);
  });

  it('acepta un DNI de 8 dígitos con puntos', () => {
    const result = validateDNI('12.345.678');
    expect(result.isValid).toBe(true);
  });

  it('acepta un DNI de 7 dígitos', () => {
    expect(validateDNI('1234567').isValid).toBe(true);
  });
});

describe('validatePhone', () => {
  it('es válido cuando está vacío (campo opcional)', () => {
    expect(validatePhone('')).toEqual({ isValid: true });
  });

  it('rechaza un teléfono de menos de 8 dígitos', () => {
    const result = validatePhone('123456');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('El número de teléfono es muy corto');
  });

  it('acepta un teléfono con formato (espacios y guiones) si tiene 8+ dígitos', () => {
    const result = validatePhone('+54 9 11 1234-5678');
    expect(result.isValid).toBe(true);
  });
});
