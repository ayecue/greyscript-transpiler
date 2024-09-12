import {
  ASTBinaryExpression,
  ASTChunk
} from 'miniscript-core';

import { UglifyFactory as BasicUglifyFactory, DependencyLike, TokenType, TransformerDataObject, TransformerLike } from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { injectImport } from '../utils/inject-imports';
import { DefaultFactoryOptions } from 'greybel-transpiler/dist/build-map/factory';

export class UglifyFactory extends BasicUglifyFactory {
  constructor(options: TransformerLike<DefaultFactoryOptions>) {
    super(options);
    this.extend();
  }

  transform(item: ASTChunk, dependency: DependencyLike): string {
    this._tokens = [];
    this._currentDependency = dependency;
    this.process(item);

    let output = '';

    for (let index = 0; index < this.tokens.length - 1; index++) {
      const token = this.tokens[index];

      if (token.type === TokenType.Text) {
        output += token.value;
      } else if (token.type === TokenType.EndOfLine) {
        output += '\n';
      } else {
        throw new Error('Unknown token type!');
      }
    }

    return output;
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
        this: UglifyFactory,
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
