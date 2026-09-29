/**
 * Proyecto multi-config: los servicios que hablan con Supabase corren en
 * entorno Node ("logic") -- necesario para que `msw/node` pueda interceptar
 * los fetch de @supabase/supabase-js (su export map bloquea "msw/node" bajo
 * la condición de resolución "react-native" que usa el preset RN por
 * defecto). Todo lo demás (lógica pura, y a futuro componentes/pantallas)
 * corre en el preset RN normal ("app"), que es el que ya venía funcionando.
 */
const asyncStorageMock = {
  '^@react-native-async-storage/async-storage$':
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
};

// En el proyecto "logic" (entorno Node) no hay runtime de React Native, así
// que el polyfill de URL de RN no aplica — Node ya trae URL/URLSearchParams.
const logicModuleNameMapper = {
  ...asyncStorageMock,
  '^react-native-url-polyfill/auto$': '<rootDir>/src/test/mocks/emptyModule.js',
};

module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/src/test/setupEnv.js'],
      moduleNameMapper: asyncStorageMock,
      testMatch: [
        '<rootDir>/src/services/calculations/**/__tests__/**/*.test.ts',
        '<rootDir>/src/utils/**/__tests__/**/*.test.ts',
        '<rootDir>/src/components/**/__tests__/**/*.test.tsx',
        '<rootDir>/src/app/**/__tests__/**/*.test.tsx',
      ],
    },
    {
      displayName: 'logic',
      preset: 'jest-expo/node',
      setupFiles: ['<rootDir>/src/test/setupEnv.js'],
      setupFilesAfterEnv: ['<rootDir>/src/test/msw/setupServer.ts'],
      moduleNameMapper: logicModuleNameMapper,
      testMatch: [
        '<rootDir>/src/services/supabase/**/__tests__/**/*.test.ts',
        '<rootDir>/src/store/**/__tests__/**/*.test.ts',
      ],
      // msw y @mswjs/interceptors distribuyen varias dependencias como ESM puro
      // (.mjs, sin build CJS) — hay que dejar que babel-jest las transforme
      // también, si no Jest no puede parsear su `import`/`export` en node_modules.
      moduleFileExtensions: ['node.ts', 'node.tsx', 'node.js', 'node.jsx', 'web.ts', 'web.tsx', 'web.js', 'web.jsx', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'wasm'],
      transform: {
        '\\.[cm]?[jt]sx?$': ['babel-jest', { configFile: true }],
      },
      // msw arrastra varias dependencias ESM-only (rettime, until-async, etc.)
      // que van cambiando de versión a versión — en vez de mantener una
      // allowlist frágil, transformamos todo node_modules en este proyecto.
      transformIgnorePatterns: [],
    },
  ],
};
