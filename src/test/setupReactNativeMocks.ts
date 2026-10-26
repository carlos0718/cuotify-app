// Usa `jest.mock()` (no `moduleNameMapper`) porque el mock oficial de
// react-native-safe-area-context llama internamente a
// `jest.requireActual('react-native-safe-area-context')` para obtener los
// Context reales -- con `moduleNameMapper` esa llamada también quedaría
// redirigida al propio mock (resolución estática, sin distinguir
// requireActual), rompiendo los Context. `jest.mock()` sí lo bypassea.
//
// Devolvemos el objeto `default` del mock "aplanado" (sin envoltorio ESM)
// para que un `import { useSafeAreaInsets } from '...'` en otro archivo
// pueda resolverlo como named export vía el interop de Babel.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// Con la caché de Babel fría (CI, o tras cambiar dependencias) el primer
// render de react-native de cada archivo transforma el árbol entero y supera
// los 5s por defecto de Jest. `testTimeout` en la config no aplica por
// proyecto, por eso se fija acá.
jest.setTimeout(30000);
