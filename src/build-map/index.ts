import { FactoryConstructor } from 'greybel-transpiler';
import { DefaultFactoryOptions } from 'greybel-transpiler/dist/build-map/factory';

import { BeautifyFactory } from './beautify';
import { DefaultFactory } from './default';
import { UglifyFactory } from './uglify';

export enum BuildType {
  DEFAULT,
  UGLIFY,
  BEAUTIFY
}

const FACTORIES: Record<
  BuildType,
  FactoryConstructor<DefaultFactoryOptions>
> = {
  [BuildType.DEFAULT]: DefaultFactory,
  [BuildType.UGLIFY]: UglifyFactory,
  [BuildType.BEAUTIFY]: BeautifyFactory
};

export function getFactory(
  type: BuildType = BuildType.DEFAULT
): FactoryConstructor<DefaultFactoryOptions> {
  const factory = FACTORIES[type];

  if (!factory) {
    throw new Error('Unknown build type.');
  }

  return factory;
}
