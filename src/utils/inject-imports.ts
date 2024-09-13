import { Context } from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { ASTBase } from 'miniscript-core';

import { ContextDataProperty } from '../context';
import { Dependency } from '../dependency';

export type AstRefDependencyMap = Map<
  ASTBase,
  {
    main: Dependency;
    imports: Set<Dependency>;
  }
>;
export type ProcessImportPathCallback = (path: string) => string;

export function injectImport(
  context: Context,
  item: ASTImportCodeExpression
): string[] {
  const astRefDependencyMap = context.get<AstRefDependencyMap>(
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

  if (astRefDependencyMap.has(item)) {
    const lines: string[] = [];
    const entry = astRefDependencyMap.get(item);

    if (astRefsVisited.has(entry.main.target)) {
      return lines;
    }

    for (const importEntry of entry.imports) {
      if (astRefsVisited.has(importEntry.target)) continue;
      if (importEntry.ref instanceof ASTImportCodeExpression) {
        lines.push(`import_code("${processImportPath(importEntry.target)}")`);
      }

      astRefsVisited.add(importEntry.target);
    }

    lines.push(`import_code("${processImportPath(entry.main.target)}")`);
    astRefsVisited.add(entry.main.target);

    return lines;
  }

  return [];
}
