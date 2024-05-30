import { Context } from 'greybel-transpiler';
import { ASTBase } from 'miniscript-core';

import { TransformerDataObject } from '../transformer';
import { beautifyFactory } from './beautify';
import { BuildMap, defaultFactory } from './default';
import { uglifyFactory } from './uglify';

export enum BuildType {
  DEFAULT,
  UGLIFY,
  BEAUTIFY
}

export { BuildMap } from './default';

const FACTORIES = {
  [BuildType.DEFAULT]: defaultFactory,
  [BuildType.UGLIFY]: uglifyFactory,
  [BuildType.BEAUTIFY]: beautifyFactory
};

export function getFactory(
  type: BuildType = BuildType.DEFAULT
): (
  make: (item: ASTBase, _data: TransformerDataObject) => string,
  context: Context,
  environmentVariables: Map<string, string>
) => BuildMap {
  const factory = FACTORIES[type];

  if (!factory) {
    throw new Error('Unknown build type.');
  }

  return factory;
}
