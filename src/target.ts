import EventEmitter from 'events';
import {
  BuildError,
  Context,
  ResourceHandler,
  TargetOptions
} from 'greybel-transpiler';
import { ASTChunkGreyScript, Parser } from 'greyscript-core';
import { ASTLiteral } from 'miniscript-core';

import { ContextDataProperty } from './context';
import { Dependency, DependencyType } from './dependency';
import { generateDependencyMappingKey, KeyRefDependencyMap } from './utils/inject-imports';
import { ChunkProvider } from './utils/chunk-provider';
import { ResourceManager } from './utils/resource-manager';

export interface TargetParseResultItem {
  chunk: ASTChunkGreyScript;
  dependency: Dependency;
}

export interface TargetParseResult {
  main: TargetParseResultItem;
  nativeImports: Map<string, TargetParseResultItem>;
}

export class Target extends EventEmitter {
  target: string;
  resourceHandler: ResourceHandler;
  context: Context;

  constructor(options: TargetOptions) {
    super();

    const me = this;

    me.target = options.target;
    me.resourceHandler = options.resourceHandler;
    me.context = options.context;
  }

  async parse(): Promise<TargetParseResult> {
    const me = this;
    const resourceHandler = me.resourceHandler;
    const target = await resourceHandler.resolve(me.target);

    if (!(await resourceHandler.has(target))) {
      throw new Error('Target ' + target + ' does not exist...');
    }

    const context = me.context;
    const chunkProvider = new ChunkProvider();
    const resourceManager = new ResourceManager({
      resourceHandler,
      chunkProvider
    });

    try {
      await resourceManager.load(target);

      const dependency = new Dependency({
        target,
        resourceManager,
        chunk: resourceManager.getEntryPointResource().chunk as ASTChunkGreyScript,
        context
      });

      const { namespaces, literals } = dependency.findDependencies();

      const parsedImports: Map<string, TargetParseResultItem> = new Map();
      const astRefDependencyMap =
        me.context.getOrCreateData<KeyRefDependencyMap>(
          ContextDataProperty.ASTRefDependencyMap,
          () => new Map()
        );

      for (const item of dependency.dependencies.values()) {
        if (item.type === DependencyType.NativeImport) {
          const relatedImports = item.fetchNativeImports(item.target);

          for (const subImport of relatedImports.values()) {
            parsedImports.set(subImport.target, {
              chunk: subImport.chunk,
              dependency: subImport
            });
          }

          parsedImports.set(item.target, {
            chunk: item.chunk,
            dependency: item
          });

          astRefDependencyMap.set(generateDependencyMappingKey(dependency, item.target), {
            main: item,
            imports: relatedImports
          });
        }
      }
      const uniqueNamespaces = new Set(namespaces);

      console.log(astRefDependencyMap);

      for (const namespace of uniqueNamespaces) {
        context.variables.createNamespace(namespace);
      }

      for (const literal of literals) {
        context.literals.add(literal as ASTLiteral);
      }

      return {
        main: {
          chunk: dependency.chunk,
          dependency
        },
        nativeImports: parsedImports
      };
    } catch (err: any) {
      if (err instanceof BuildError) {
        throw err;
      }

      throw new BuildError(err.message, {
        target: this.target,
        range: err.range
      });
    }
  }
}
