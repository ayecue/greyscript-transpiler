import {
  Resource,
  ResourceManager as GreybelResourceManager,
  ResourceManagerLike
} from 'greybel-transpiler';
import { ASTChunkGreyScript } from 'greyscript-core';
import { ASTBase } from 'miniscript-core';

export class ResourceManager
  extends GreybelResourceManager
  implements ResourceManagerLike
{
  protected async enrichResource(resource: Resource): Promise<void> {
    const { imports, includes, nativeImports, injects } =
      resource.chunk as ASTChunkGreyScript;
    const resourcePaths: { ref: ASTBase, resolved: string }[] = await Promise.all([
      ...imports.map(async (item) => {
        return {
          ref: item,
          resolved: await this.createMapping(resource.target, item.path)
        };
      }),
      ...includes.map(async (item) => {
        return {
          ref: item,
          resolved: await this.createMapping(resource.target, item.path)
        };
      }),
      ...nativeImports
        .filter((item) => {
          return item.eval && item.emit;
        })
        .map(async (item) => {
          return {
            ref: item,
            resolved: await this.createMapping(resource.target, item.directory)
          };
        })
    ]);

    await Promise.all([
      ...resourcePaths.map(async (resourcePath) => {
        await this.loadResource(resourcePath.resolved, {
          target: resource.target,
          ref: resourcePath.ref
        });
      }),
      ...injects.map(async (item) => {
        const depTarget = await this.createMapping(resource.target, item.path);
        await this.createInjection(depTarget, {
          target: resource.target,
          ref: item
        });
      })
    ]);
  }
}
