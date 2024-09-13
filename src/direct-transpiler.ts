import {
  Context,
  DirectTranspiler as GreybelDirectTranspiler,
  fetchNamespaces,
  generateCharsetMap,
  OutputProcessor,
  Transformer,
  BuildType
} from 'greybel-transpiler';
import { ASTChunkGreyScript, Parser } from 'greyscript-core';
import { ASTLiteral } from 'miniscript-core';

import { HEADER_BOILERPLATE, MAIN_BOILERPLATE } from './boilerplates';
import { getFactory } from './build-map';

export class DirectTranspiler extends GreybelDirectTranspiler {
  parse(): string {
    const me = this;

    const factoryConstructor = getFactory(me.buildType);
    const parser = new Parser(me.code);
    const chunk = parser.parseChunk() as ASTChunkGreyScript;
    const namespaces = fetchNamespaces(chunk);
    const literals = [].concat(chunk.literals);
    const charsetMap = generateCharsetMap(me.obfuscation);
    const context = new Context({
      variablesCharset: charsetMap.variables,
      variablesExcluded: me.excludedNamespaces,
      modulesCharset: charsetMap.modules
    });
    const uniqueNamespaces = new Set(namespaces);
    uniqueNamespaces.forEach((namespace: string) =>
      context.variables.createNamespace(namespace)
    );

    literals.forEach((literal: ASTLiteral) => context.literals.add(literal));

    const transformer = new Transformer({
      buildOptions: me.buildOptions,
      factoryConstructor,
      context,
      environmentVariables: me.environmentVariables
    });
    const output = new OutputProcessor(context, transformer, {
      main: MAIN_BOILERPLATE,
      header: HEADER_BOILERPLATE
    });

    if (this.buildType === BuildType.UGLIFY && !me.buildOptions.disableLiteralsOptimization) {
      output.addLiteralsOptimization();
    }

    const result = transformer.transform(chunk);

    output.addCode(result);

    return output.build();
  }
}
