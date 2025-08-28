module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(svg)$': '<rootDir>/src/tests/__mocks__/fileMock.ts'
  },
  testMatch: ['<rootDir>/src/**/?(*.)+(spec|test).[tj]s?(x)']
};
