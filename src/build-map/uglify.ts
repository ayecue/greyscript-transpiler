import {
  DefaultFactoryOptions,
  TransformerDataObject,
  TransformerLike,
  UglifyFactory as BasicUglifyFactory
} from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { ASTBinaryExpression } from 'miniscript-core';

import { injectImport } from '../utils/inject-imports';

export class UglifyFactory extends BasicUglifyFactory {
  constructor(options: TransformerLike<DefaultFactoryOptions>) {
    super(options);
    this.extend();
  }

  extend() {
    this.handlers = {
      ...this.handlers,
      BinaryExpression: function (
        this: UglifyFactory,
        item: ASTBinaryExpression,
        _data: TransformerDataObject
      ): void {
        if (
          !this.transformer.buildOptions.isDevMode &&
          (item.operator === '<<' ||
            item.operator === '>>' ||
            item.operator === '>>>' ||
            item.operator === '|' ||
            item.operator === '&')
        ) {
          this.pushSegment('bitwise("' + item.operator + '",');
          this.process(item.left);
          this.pushSegment(',');
          this.process(item.right);
          this.pushSegment(')');
          return;
        }

        this.process(item.left);
        this.pushSegment(item.operator);
        this.process(item.right);
      },
      ImportCodeExpression: function (
        this: UglifyFactory,
        item: ASTImportCodeExpression,
        _data: TransformerDataObject
      ): void {
        if (this.transformer.buildOptions.isDevMode) {
          this.pushSegment(`import_code("${item.originalDirectory}")`);
          const flags: string[] = [];
          if (!item.eval) flags.push('no-eval');
          if (!item.emit) flags.push('no-emit');
          if (item.directory !== item.originalDirectory)
            flags.push(`override=${item.directory}`);
          if (flags.length > 0) this.pushSegment(`//${flags.join(';')};`);
          return;
        }
        if (!item.emit) {
          return;
        }
        if (!item.eval) {
          this.pushSegment(`import_code("${item.directory}")`);
          return;
        }

        const injections = injectImport(
          this.transformer.context,
          this.originDependency,
          this.activeDependency,
          item
        );

        for (let index = 0; index < injections.length; index++) {
          this.pushSegment(injections[index]);
          if (index < injections.length - 1) this.eol();
        }
      }
    };
  }
}
