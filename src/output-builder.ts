import { Context, OutputProcessor, Transformer } from "greybel-transpiler";
import { TargetParseResult, TargetParseResultItem } from "./target";
import { Dependency, DependencyType } from "./dependency";
import { HEADER_BOILERPLATE, MAIN_BOILERPLATE } from "./boilerplates";

export interface OutputBuilderOptions {
  transformer: Transformer;
  moduleBoilerplate: string;
  parseResult: TargetParseResult;
  context: Context;
}

export class OutputBuilder {
  private transformer: Transformer;
  private moduleBoilerplate: string;
  private parseResult: TargetParseResult;
  private context: Context;
  private modulesCount: number;
  private modulesRegistry: Map<string, Record<string, string>>;

  constructor(options: OutputBuilderOptions) {
    this.transformer = options.transformer;
    this.moduleBoilerplate = options.moduleBoilerplate;
    this.parseResult = options.parseResult;
    this.context = options.context;
    this.modulesCount = 0;
    this.modulesRegistry = new Map<string, Record<string, string>>();
  }

  private aggregateModules(mainDependency: Dependency) {
    const mainNamespace = this.context.modules.get(mainDependency.getId());
    const modules: Record<string, string> = {};
    const iterator = (item: Dependency) => {
      const moduleName = item.getNamespace();

      if (moduleName in modules) return;
      if (
        moduleName !== mainNamespace &&
        item.type === DependencyType.Import
      ) {
        const code = this.transformer.transform(item.chunk, item);
        modules[moduleName] = this.moduleBoilerplate
          .replace('"$0"', () => '"' + moduleName + '"')
          .replace('"$1"', () => code);
        this.modulesCount++;
      }

      for (const subItem of item.dependencies) {
        if (subItem.type !== DependencyType.NativeImport) {
          iterator(subItem);
        }
      }
    };

    iterator(mainDependency);

    this.modulesRegistry.set(mainDependency.target, modules);
  }

  private generateOutputCode(mainDependency: Dependency, isNativeImport: boolean): string {
    const modules = this.modulesRegistry.get(mainDependency.target) || {};
    const output = new OutputProcessor(this.context, this.transformer, {
      main: MAIN_BOILERPLATE,
      header: HEADER_BOILERPLATE
    });

    if (!isNativeImport) {
      output.addOptimizations();
      if (this.modulesCount > 0) output.addHeader();
    }

    Object.keys(modules).forEach((moduleKey: string) =>
      output.addCode(modules[moduleKey])
    );

    const code = this.transformer.transform(mainDependency.chunk, mainDependency);

    output.addCode(code, !isNativeImport);

    return output.build();
  }

  build(): Record<string, string> {
    const { main, nativeImports } = this.parseResult;

    this.aggregateModules(main.dependency);
    nativeImports.forEach((item) => {
      this.aggregateModules(item.dependency);
    });

    return {
      [main.dependency.target]: this.generateOutputCode(main.dependency, false),
      ...Array.from(nativeImports.values()).reduce(
        (result: Record<string, string>, value: TargetParseResultItem) => {
          return {
            ...result,
            [value.dependency.target]: this.generateOutputCode(value.dependency, true)
          };
        },
        {}
      )
    };
  }
}