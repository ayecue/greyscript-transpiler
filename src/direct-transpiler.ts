import {
  ChunkProvider,
  Context,
  DirectTranspiler as GreybelDirectTranspiler,
  fetchNamespaces,
  generateCharsetMap,
  OutputProcessor,
  Transformer
} from 'greybel-transpiler';
import { ASTChunkGreyScript } from 'greyscript-core';
import { ASTLiteral } from 'miniscript-core';

import { HEADER_BOILERPLATE, MAIN_BOILERPLATE } from './boilerplates';
import { getFactory } from './build-map';

export class DirectTranspiler extends GreybelDirectTranspiler {
  parse(): string {
    const me = this;

    const factoryConstructor = getFactory(me.buildType);
    const chunkProvider = new ChunkProvider();
    const chunk = chunkProvider.parse('unknown', me.code) as ASTChunkGreyScript;
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

    output.addOptimizations();

    const result = transformer.transform(chunk);

    output.addCode(result);

    return output.build();
  }
}
