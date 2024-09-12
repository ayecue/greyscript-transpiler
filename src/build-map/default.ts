import {
  ASTBinaryExpression,
  ASTBase
} from 'miniscript-core';

import { DefaultFactory as BasicDefaultFactory, TokenType, TransformerDataObject, TransformerLike } from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { injectImport } from '../utils/inject-imports';
import { DefaultFactoryOptions } from 'greybel-transpiler/dist/build-map/factory';

export class DefaultFactory extends BasicDefaultFactory {
  constructor(options: TransformerLike<DefaultFactoryOptions>) {
    super(options);
    this.extend();
  }

  extend() {
    this.handlers = {
      ...this.handlers,
      BinaryExpression: function (
        this: DefaultFactory,
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
          this.tokens.push({
            type: TokenType.Text,
            value: `bitwise("${item.operator}",`,
            ref: item
          });
          this.process(item.left);
          this.tokens.push({
            type: TokenType.Text,
            value: ',',
            ref: item
          });
          this.process(item.right);
          this.tokens.push({
            type: TokenType.Text,
            value: ')',
            ref: item
          });
          return;
        }
  
        this.process(item.left);
        this.tokens.push({
          type: TokenType.Text,
          value: item.operator,
          ref: item
        });
        this.process(item.right);
      },
      ImportCodeExpression: function (
        this: DefaultFactory,
        item: ASTImportCodeExpression,
        _data: TransformerDataObject
      ): void {
        this.tokens.push({
          type: TokenType.Text,
          value: injectImport(this.transformer.context, item),
          ref: item
        });
      }
    }
  }
}
