import {
  DefaultFactory as BasicDefaultFactory,
  DefaultFactoryOptions,
  TokenType,
  TransformerDataObject,
  TransformerLike
} from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { ASTBinaryExpression } from 'miniscript-core';

import { injectImport } from '../utils/inject-imports';

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
        const injections = injectImport(this.transformer.context, item);

        for (let index = 0; index < injections.length; index++) {
          this.tokens.push({
            type: TokenType.Text,
            value: injections[index],
            ref: item
          });
          if (index !== injections.length - 1)
            this.tokens.push({
              type: TokenType.EndOfLine,
              value: '\n',
              ref: item
            });
        }
      }
    };
  }
}
