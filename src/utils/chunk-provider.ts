import { ChunkProviderLike } from 'greybel-transpiler';
import { ASTChunkGreyScript, Parser } from 'greyscript-core';

export class ChunkProvider implements ChunkProviderLike {
  private cache: Map<string, ASTChunkGreyScript>;
  environmentVariables: Map<string, string>;
  strictMode: boolean;

  constructor(
    environmentVariables?: Map<string, string>,
    strictMode?: boolean
  ) {
    this.cache = new Map<string, ASTChunkGreyScript>();
    this.environmentVariables = environmentVariables ?? new Map();
    this.strictMode = strictMode ?? false;
  }

  parse(target: string, content: string): ASTChunkGreyScript {
    const cachedChunk = this.cache.get(target);

    if (cachedChunk) {
      return cachedChunk;
    }

    const parser = new Parser(content, {
      filename: target,
      preserve: true,
      environmentVariables: this.environmentVariables,
      strictMode: this.strictMode
    });
    const chunk = parser.parseChunk() as ASTChunkGreyScript;
    this.cache.set(target, chunk);
    return chunk;
  }
}
