import {
  OutputProcessor,
  Transformer,
  Transpiler as GreybelTranspiler,
  TranspilerOptions as GreybelTranspilerOptions,
  TranspilerParseResult,
  BuildType
} from 'greybel-transpiler';

import {
  HEADER_BOILERPLATE,
  MAIN_BOILERPLATE,
  MODULE_BOILERPLATE
} from './boilerplates';
import { getFactory } from './build-map';
import { ContextDataProperty } from './context';
import { Dependency, DependencyType } from './dependency';
import { Target, TargetParseResult, TargetParseResultItem } from './target';
import { ProcessImportPathCallback } from './utils/inject-imports';

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
    const mainModule = targetParseResult.main;
    const moduleBoilerplate = transformer.transform(MODULE_BOILERPLATE);
    const build = (
      mainDependency: Dependency,
      isNativeImport: boolean
    ): string => {
      const mainNamespace = context.modules.get(mainDependency.getId());
      const modules: { [key: string]: string } = {};
      let moduleCount = 0;
      const iterator = function (item: Dependency) {
        const moduleName = item.getNamespace();

        if (moduleName in modules) return;
        if (
          moduleName !== mainNamespace &&
          item.type === DependencyType.Import
        ) {
          const code = transformer.transform(item.chunk, item);
          modules[moduleName] = moduleBoilerplate
            .replace('"$0"', '"' + moduleName + '"')
            .replace('"$1"', code);
          moduleCount++;
        }

        for (const subItem of item.dependencies) {
          if (item.type !== DependencyType.NativeImport) {
            iterator(subItem);
          }
        }
      };

      iterator(mainDependency);

      const output = new OutputProcessor(context, transformer, {
        main: MAIN_BOILERPLATE,
        header: HEADER_BOILERPLATE
      });

      if (!isNativeImport) {
        output.addOptimizations();
        if (moduleCount > 0) output.addHeader();
      }

      Object.keys(modules).forEach((moduleKey: string) =>
        output.addCode(modules[moduleKey])
      );

      const code = transformer.transform(mainDependency.chunk, mainDependency);

      output.addCode(code, !isNativeImport);

      return output.build();
    };

    return {
      [me.target]: build(
        mainModule.dependency,
        false
      ),
      ...Array.from(targetParseResult.nativeImports.values()).reduce(
        (result: TranspilerParseResult, value: TargetParseResultItem) => {
          return {
            ...result,
            [value.dependency.target]: build(
              value.dependency,
              true
            )
          };
        },
        {}
      )
    };
  }
}
