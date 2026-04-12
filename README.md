# greyscript-transpiler

[![greyscript-transpiler](https://circleci.com/gh/ayecue/greyscript-transpiler.svg?style=svg)](https://circleci.com/gh/ayecue/greyscript-transpiler)

A transpiler for [GreyScript](https://github.com/ayecue/greybel-js) (the [Grey Hack](https://store.steampowered.com/app/605230/Grey_Hack/) flavour of MiniScript) written in TypeScript. It extends [greybel-transpiler](../greybel-transpiler) with GreyScript-specific parsing and code generation via [greyscript-core](../greyscript-core).

## Features

* Extends `greybel-transpiler` with GreyScript-aware AST handling
* Three build modes: **default**, **beautify**, and **uglify**
* Automatic dependency resolution for `#include` and `#import` directives
* Variable and module namespace obfuscation
* Environment variable injection at transpile time
* `DirectTranspiler` for quick single-file transpilation without resource loading
* `Transpiler` for full multi-file builds with dependency graphs and installer output
* Optional `processImportPathCallback` for custom import path rewriting
* Written in TypeScript with type definitions included

## Install

```
npm install greyscript-transpiler
```

## Usage

### Single file (DirectTranspiler)

```ts
import { DirectTranspiler, BuildType } from 'greyscript-transpiler';

const result = new DirectTranspiler({
  code: 'print "hello world"',
  buildType: BuildType.BEAUTIFY,
  obfuscation: false
}).parse();

console.log(result);
```

### Multi-file project (Transpiler)

```ts
import { Transpiler, BuildType } from 'greyscript-transpiler';

const result = await new Transpiler({
  target: '/path/to/main.src',
  buildType: BuildType.DEFAULT,
  obfuscation: true,
  installer: true,
  environmentVariables: new Map([['VERSION', '"1.0.0"']])
}).parse();

// result is a record of output filename to transpiled code
console.log(result);
```

## Build Types

| Type | Description |
|------|-------------|
| `BuildType.DEFAULT` | Emits code with minimal transformation |
| `BuildType.BEAUTIFY` | Pretty-prints the output with configurable indentation |
| `BuildType.UGLIFY` | Minifies the output for smaller file size |

## Testing

```
npm test
```