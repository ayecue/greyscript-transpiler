import {
  ASTBase,
  ASTBinaryExpression
} from 'miniscript-core';

import { BeautifyFactory as BasicBeautifyFactory, BeautifyOptions, TokenType, TransformerDataObject, TransformerLike } from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { injectImport } from '../utils/inject-imports';

export class BeautifyFactory extends BasicBeautifyFactory {
  constructor(options: TransformerLike<BeautifyOptions>) {
    super(options);
    this.extend();
  }

  extend() {
    this.handlers = {
      ...this.handlers,
      BinaryExpression: function (
        this: BeautifyFactory,
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
            value: `bitwise("${item.operator}", `,
            ref: item
          });
          this.process(item.left);
          this.tokens.push({
            type: TokenType.Text,
            value: ', ',
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
          value: ' ' + item.operator + ' ',
          ref: item
        });
        this.process(item.right);
      },
      ImportCodeExpression: function (
        this: BeautifyFactory,
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
