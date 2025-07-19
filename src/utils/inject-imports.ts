import { Context, DependencyLike } from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';

import { ContextDataProperty } from '../context';
import { Dependency, DependencyType } from '../dependency';

export type KeyRefDependencyMap = Map<
  string,
  {
    main: Dependency;
    imports: Map<string, Dependency>;
  }
>;
export type ProcessImportPathCallback = (path: string) => string;

export function generateDependencyMappingKey(
  dependency: DependencyLike,
  nativeImportPath: string,
): string {
  return `${dependency.target}:${nativeImportPath}`;
}

export function injectImport(
  context: Context,
  originDependency: DependencyLike,
  activeDependency: DependencyLike,
  item: ASTImportCodeExpression
): string[] {
  const astRefDependencyMap = context.get<KeyRefDependencyMap>(
    ContextDataProperty.ASTRefDependencyMap
  );
  const processImportPath = context.getOrCreateData<ProcessImportPathCallback>(
    ContextDataProperty.ProcessImportPathCallback,
    () => (item: string) => item
  );

  if (!astRefDependencyMap) {
    return [`import_code("${processImportPath(item.directory)}")`];
  }

  const astRefsVisited = context.getOrCreateData<Set<string>>(
    ContextDataProperty.ASTRefsVisited,
    () => new Set()
  );

  const dependencyKey = Dependency.generateDependencyMappingKey(item.directory, DependencyType.NativeImport);
  const associatedDependency = activeDependency.dependencies.get(dependencyKey);
  const key = generateDependencyMappingKey(originDependency, associatedDependency.target);

  if (astRefDependencyMap.has(key)) {
    const lines: string[] = [];
    const entry = astRefDependencyMap.get(key);

    if (astRefsVisited.has(entry.main.target)) {
      return lines;
    }

    for (const importEntry of entry.imports.values()) {
      if (astRefsVisited.has(importEntry.target)) continue;
      lines.push(`import_code("${processImportPath(importEntry.target)}")`);

      astRefsVisited.add(importEntry.target);
    }

    lines.push(`import_code("${processImportPath(entry.main.target)}")`);
    astRefsVisited.add(entry.main.target);

    return lines;
  }

  return [];
}
