import {
  Transformer,
  Transpiler as GreybelTranspiler,
  TranspilerOptions as GreybelTranspilerOptions,
  TranspilerParseResult
} from 'greybel-transpiler';

import {
  MODULE_BOILERPLATE
} from './boilerplates';
import { getFactory } from './build-map';
import { ContextDataProperty } from './context';
import { Target, TargetParseResult } from './target';
import { ProcessImportPathCallback } from './utils/inject-imports';
import { OutputBuilder } from './output-builder';

export interface TranspilerOptions extends GreybelTranspilerOptions {
  processImportPathCallback?: ProcessImportPathCallback;
}

export class Transpiler extends GreybelTranspiler {
  constructor(options: TranspilerOptions) {
    super(options);
    const me = this;

    if (options.processImportPathCallback) {
      me.context.set(
        ContextDataProperty.ProcessImportPathCallback,
        options.processImportPathCallback
      );
    }
  }

  async parse(): Promise<TranspilerParseResult> {
    const me = this;
    const factoryConstructor = getFactory(me.buildType);
    const context = me.context;
    const target = new Target({
      target: me.target,
      resourceHandler: me.resourceHandler,
      context: me.context
    });
    const targetParseResult: TargetParseResult = await target.parse();

    // create builder
    const transformer = new Transformer({
      buildOptions: me.buildOptions,
      factoryConstructor,
      context,
      environmentVariables: me.environmentVariables,
      resourceHandler: me.resourceHandler
    });
    const moduleBoilerplate = transformer.transform(MODULE_BOILERPLATE);
    const outputBuilder = new OutputBuilder({
      transformer,
      moduleBoilerplate,
      parseResult: targetParseResult,
      context
    });

    return outputBuilder.build();
  }
}
