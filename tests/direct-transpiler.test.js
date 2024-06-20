const { DirectTranspiler, BuildType } = require('../dist');
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
        const result = new DirectTranspiler({
          code: fs.readFileSync(filepath, 'utf-8'),
          environmentVariables,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(result).toMatchSnapshot();
      });

      test(path.basename(filepath) + ' uglify', async () => {
        const result = new DirectTranspiler({
          code: fs.readFileSync(filepath, 'utf-8'),
          buildType: BuildType.UGLIFY,
          environmentVariables,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(result).toMatchSnapshot();
      });

      test(path.basename(filepath) + ' beautify', async () => {
        const result = new DirectTranspiler({
          code: fs.readFileSync(filepath, 'utf-8'),
          buildType: BuildType.BEAUTIFY,
          environmentVariables,
          excludedNamespaces: Array.from(Object.keys(greyscriptMeta.getSignaturesByType('general')))
        }).parse();

        expect(result).toMatchSnapshot();
      });

      test(path.basename(filepath) + ' beautify with custom settings', async () => {
        const result = new DirectTranspiler({
          code: fs.readFileSync(filepath, 'utf-8'),
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

        expect(result).toMatchSnapshot();
      });
    });
  });
});
