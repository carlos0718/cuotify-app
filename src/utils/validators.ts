/**
 * Validadores de formularios
 */

// Lista de TLDs comunes válidos
const VALID_TLDS = [
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'io', 'co', 'info', 'biz',
  // Latinoamérica
  'ar', 'com.ar', 'mx', 'com.mx', 'cl', 'co', 'com.co', 'pe', 'com.pe',
  'br', 'com.br', 'uy', 'com.uy', 'ec', 'com.ec', 'bo', 'com.bo',
  've', 'com.ve', 'py', 'com.py', 'cr', 'co.cr',
  // Europa
  'es', 'de', 'fr', 'it', 'uk', 'co.uk', 'pt', 'nl', 'be', 'ch', 'at',
  // Otros
  'app', 'dev', 'me', 'tv', 'xyz', 'online', 'site', 'website', 'email',
];

// Errores comunes de TLD (typos)
const COMMON_TLD_TYPOS: Record<string, string> = {
  'con': 'com',
  'cim': 'com',
  'coom': 'com',
  'comm': 'com',
  'cm': 'com',
  'om': 'com',
  'vom': 'com',
  'xom': 'com',
  'nte': 'net',
  'ney': 'net',
  'nte': 'net',
  'ogr': 'org',
  'prg': 'org',
  'orh': 'org',
  'arg': 'ar',
  'ar.com': 'com.ar',
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Valida un email con verificación de formato y TLD
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmedEmail = email.trim().toLowerCase();

  // Verificar que no esté vacío
  if (!trimmedEmail) {
    return {
      isValid: false,
      error: 'El correo electrónico es requerido',
    };
  }

  // Regex básico para formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'El formato del correo no es válido',
    };
  }

  // Regex más estricto para validación completa
  const strictEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!strictEmailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'El correo contiene caracteres no válidos',
    };
  }

  // Extraer el dominio y TLD
  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: 'El formato del correo no es válido',
    };
  }

  const domain = parts[1];
  const domainParts = domain.split('.');

  if (domainParts.length < 2) {
    return {
      isValid: false,
      error: 'El dominio del correo no es válido',
    };
  }

  // Obtener el TLD (puede ser compuesto como com.ar)
  const lastPart = domainParts[domainParts.length - 1];
  const secondLastPart = domainParts.length >= 3 ? domainParts[domainParts.length - 2] : null;

  // Verificar TLDs compuestos primero (com.ar, co.uk, etc.)
  const compoundTld = secondLastPart ? `${secondLastPart}.${lastPart}` : null;

  // Verificar si es un typo común
  if (COMMON_TLD_TYPOS[lastPart]) {
    const correctTld = COMMON_TLD_TYPOS[lastPart];
    const correctedEmail = trimmedEmail.replace(new RegExp(`\\.${lastPart}$`), `.${correctTld}`);
    return {
      isValid: false,
      error: `¿Quisiste decir ".${correctTld}"?`,
      suggestion: correctedEmail,
    };
  }

  // Verificar si el TLD es válido
  const isValidTld = VALID_TLDS.includes(lastPart) ||
                     (compoundTld && VALID_TLDS.includes(compoundTld));

  if (!isValidTld) {
    // Buscar TLD similar para sugerir
    const similarTld = findSimilarTld(lastPart);
    if (similarTld) {
      const correctedEmail = trimmedEmail.replace(new RegExp(`\\.${lastPart}$`), `.${similarTld}`);
      return {
        isValid: false,
        error: `El dominio ".${lastPart}" parece incorrecto. ¿Quisiste decir ".${similarTld}"?`,
        suggestion: correctedEmail,
      };
    }

    return {
      isValid: false,
      error: `El dominio ".${lastPart}" no parece ser válido`,
    };
  }

  return { isValid: true };
}

/**
 * Encuentra un TLD similar al proporcionado
 */
function findSimilarTld(tld: string): string | null {
  // Primero verificar typos comunes
  if (COMMON_TLD_TYPOS[tld]) {
    return COMMON_TLD_TYPOS[tld];
  }

  // Buscar TLD con distancia de edición pequeña
  for (const validTld of VALID_TLDS) {
    if (levenshteinDistance(tld, validTld) <= 1) {
      return validTld;
    }
  }

  return null;
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1,     // inserción
          matrix[i - 1][j] + 1      // eliminación
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Valida la longitud de una contraseña
 */
export function validatePassword(password: string): EmailValidationResult {
  if (!password) {
    return {
      isValid: false,
      error: 'La contraseña es requerida',
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'La contraseña debe tener al menos 6 caracteres',
    };
  }

  return { isValid: true };
}

/**
 * Valida un DNI argentino
 */
export function validateDNI(dni: string): EmailValidationResult {
  if (!dni) {
    return { isValid: true }; // DNI es opcional
  }

  const cleanDni = dni.replace(/\D/g, '');

  if (cleanDni.length < 7 || cleanDni.length > 8) {
    return {
      isValid: false,
      error: 'El DNI debe tener entre 7 y 8 dígitos',
    };
  }

  return { isValid: true };
}

/**
 * Valida un número de teléfono
 */
export function validatePhone(phone: string): EmailValidationResult {
  if (!phone) {
    return { isValid: true }; // Teléfono es opcional
  }

  const cleanPhone = phone.replace(/\D/g, '');

  if (cleanPhone.length < 8) {
    return {
      isValid: false,
      error: 'El número de teléfono es muy corto',
    };
  }

  return { isValid: true };
}
