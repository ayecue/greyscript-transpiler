import { ASTChunkGreyScript, Parser } from 'greyscript-core';
import { ChunkProviderLike } from 'greybel-transpiler';

export class ChunkProvider implements ChunkProviderLike {
  private cache: Map<string, ASTChunkGreyScript>;

  constructor() {
    this.cache = new Map<string, ASTChunkGreyScript>();
  }

  async parse(target: string, content: string): Promise<ASTChunkGreyScript> {
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
