module.exports = {
  displayName: 'map-picker',
  preset: '../../../jest.preset.js',
  testEnvironment: 'jsdom',
  // This workspace runs Angular zoneless (no zone.js dependency/polyfill anywhere) — see every
  // app's app.config.ts, none of which provide zone.js or ZoneChangeDetection.
  setupFilesAfterEnv: ['jest-preset-angular/setup-env/zoneless'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
  coverageDirectory: '../../../coverage/libs/shared/map-picker',
};
