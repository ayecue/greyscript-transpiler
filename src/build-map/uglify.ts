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
          item.operator === '<<' ||
          item.operator === '>>' ||
          item.operator === '>>>' ||
          item.operator === '|' ||
          item.operator === '&'
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
        if (!item.emit) {
          return;
        }
        if (!item.eval) {
          this.pushSegment(`import_code("${item.directory}")`, item);
          return;
        }

        const injections = injectImport(this.transformer.context, item);

        for (let index = 0; index < injections.length; index++) {
          this.pushSegment(injections[index], item);
          if (index < injections.length - 1) this.eol();
        }
      }
    };
  }
}
