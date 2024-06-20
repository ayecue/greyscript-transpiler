const { Transpiler, BuildType } = require('../dist');
const { greyscriptMeta } = require('greyscript-meta/dist/meta.js');
const fs = require('fs');
const path = require('path');
const testFolder = path.resolve(__dirname, 'scripts');

describe('parse', function () {
  const environmentVariables = new Map([
    ['test', '"foo"'],
    ['test2', 0.2],
    ['TEST_ENV', true]
  ]);

  describe('default scripts', function () {
    fs.readdirSync(testFolder).forEach((file) => {
      const filepath = path.resolve(testFolder, file);

      test(path.basename(filepath), async () => {
        const result = await new Transpiler({
          processImportPathCallback: (path) => path.replace(/^.*?tests/i, ''),
          target: filepath,
          environmentVariables,
          obfuscation: false,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(Object.values(result)).toMatchSnapshot();
      });

      test(path.basename(filepath) + ' uglify', async () => {
        const result = await new Transpiler({
          processImportPathCallback: (path) => path.replace(/^.*?tests/i, ''),
          target: filepath,
          buildType: BuildType.UGLIFY,
          environmentVariables,
          obfuscation: false,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(Object.values(result)).toMatchSnapshot();
      });

      test(path.basename(filepath) + ' beautify', async () => {
        const result = await new Transpiler({
          processImportPathCallback: (path) => path.replace(/^.*?tests/i, ''),
          target: filepath,
          buildType: BuildType.BEAUTIFY,
          environmentVariables,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(Object.values(result)).toMatchSnapshot();
      });

      test(path.basename(filepath) + ' beautify with custom settings', async () => {
        const result = await new Transpiler({
          target: filepath,
          buildType: BuildType.BEAUTIFY,
          buildOptions: {
            isDevMode: true,
            keepParentheses: true,
            indentation: 1,
            indentationSpaces: 10
          },
          environmentVariables,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(Object.values(result)).toMatchSnapshot();
      });
    });
  });

  describe('special scripts', function () {
    test('simple circular import', async () => {
      const testFile = path.resolve(__dirname, 'special', 'circular-import.src');

      expect(() => {
        return new Transpiler({
          processImportPathCallback: (path) => path.replace(/^.*?tests/i, ''),
          target: testFile,
          environmentVariables,
          obfuscation: false,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();
      }).rejects.toThrowError(/^Circular dependency/);
    });

    test('long circular import', async () => {
      const testFile = path.resolve(__dirname, 'special', 'long-circular-import.src');

      expect(() => {
        return new Transpiler({
          processImportPathCallback: (path) => path.replace(/^.*?tests/i, ''),
          target: testFile,
          environmentVariables,
          obfuscation: false,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();
      }).rejects.toThrowError(/^Circular dependency/);
    });
  });
});
