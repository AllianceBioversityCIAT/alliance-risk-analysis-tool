const nextJest = require('next/jest');
const path = require('path');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    // Path alias: @/* → src/*
    '^@/(.*)$': path.resolve(__dirname, 'src/$1'),
    // Fix pnpm isolation: the bundled 'radix-ui' package requires all @radix-ui/* packages
    // as peer deps but they aren't hoisted in pnpm's virtual store. Mock the bundle.
    '^radix-ui$': path.resolve(__dirname, '__mocks__/radix-ui.js'),
  },
};

module.exports = createJestConfig(customConfig);
