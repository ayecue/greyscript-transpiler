import { ChunkProviderLike } from 'greybel-transpiler';
import { ASTChunkGreyScript, Parser } from 'greyscript-core';

export class ChunkProvider implements ChunkProviderLike {
  private cache: Map<string, ASTChunkGreyScript>;

  constructor() {
    this.cache = new Map<string, ASTChunkGreyScript>();
  }

  parse(target: string, content: string): ASTChunkGreyScript {
    const cachedChunk = this.cache.get(target);

    if (cachedChunk) {
      return cachedChunk;
    }

    const parser = new Parser(content, {
      filename: target
    });
    const chunk = parser.parseChunk() as ASTChunkGreyScript;
    this.cache.set(target, chunk);
    return chunk;
  }
}
